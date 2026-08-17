#!/usr/bin/env node
'use strict';

/**
 * PancreasOS - Worker de sincronización CGM
 *
 * Lee la glucosa de Gaelito desde el FreeStyle Libre 2 (vía LibreLinkUp)
 * y la inserta en la tabla cgm_readings de Neon (PostgreSQL) cada N minutos.
 *
 * Uso:
 *   node sync.js              # ciclo continuo (producción)
 *   node sync.js --once       # un solo ciclo y salir
 *   node sync.js --dry-run    # no escribe en la base de datos
 *   node sync.js --doctor     # verifica credenciales, red y esquema
 */

const { load: loadConfig } = require('./src/config');
const { logger } = require('./src/logger');
const { LibreLinkUpClient } = require('./src/libre');
const { Database } = require('./src/db');
const { withRetry } = require('./src/retry');

const flags = new Set(process.argv.slice(2));
const RUN_ONCE = flags.has('--once') || flags.has('--doctor');
const DRY_RUN = flags.has('--dry-run') || flags.has('--doctor');
const DOCTOR = flags.has('--doctor');

// Si la última medición es más vieja que esto, el sensor probablemente
// está fuera de rango o el teléfono no ha sincronizado.
const STALE_READING_MINUTES = 15;

const state = {
  cycleInProgress: false,
  shuttingDown: false,
  timer: null,
  stats: { cycles: 0, inserted: 0, duplicates: 0, failures: 0, startedAt: Date.now() },
};

function minutesAgo(date) {
  return Math.round((Date.now() - date.getTime()) / 60000);
}

function banner(config) {
  logger.plain('');
  logger.plain('  PancreasOS - CGM Sync Worker');
  logger.plain('  ---------------------------------------------');
  logger.plain(`  Intervalo   : cada ${config.intervalMinutes} min`);
  logger.plain(`  Cuenta LLU  : ${config.libre.email}`);
  logger.plain(`  Modo        : ${DOCTOR ? 'doctor' : RUN_ONCE ? 'una vez' : 'continuo'}${DRY_RUN && !DOCTOR ? ' (dry-run)' : ''}`);
  logger.plain(`  Zona horaria: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  logger.plain('  ---------------------------------------------');
  logger.plain('');
}

/**
 * Un ciclo: leer de LibreLinkUp -> insertar en Neon.
 * Nunca lanza por errores transitorios; los cuenta y sigue vivo, porque
 * el internet de casa o la API de Abbott se caen y el worker no debe morir.
 */
async function runCycle(config, libre, db) {
  if (state.cycleInProgress) {
    logger.warn('El ciclo anterior sigue corriendo; se omite este disparo.');
    return;
  }

  state.cycleInProgress = true;
  state.stats.cycles += 1;

  try {
    const reading = await withRetry(() => libre.getLatestReading(), {
      attempts: 3,
      baseDelayMs: 3000,
      label: 'Lectura de LibreLinkUp',
    });

    if (!reading) return; // Sensor sin medición activa; ya se avisó.

    const age = minutesAgo(reading.timestamp);
    const alert = reading.isLow ? ' [BAJA]' : reading.isHigh ? ' [ALTA]' : '';

    logger.info(
      `Glucosa: ${reading.glucose} mg/dL ${reading.trendGlyph} (${reading.trendName})${alert} ` +
        `- medida hace ${age} min${reading.patientName ? ` - ${reading.patientName}` : ''}`
    );

    if (age > STALE_READING_MINUTES) {
      logger.warn(
        `La medición tiene ${age} min de antigüedad. Revisa que el teléfono de Gaelito ` +
          'tenga la app abierta, con internet y el sensor en rango.'
      );
    }

    if (reading.glucose < config.minGlucose || reading.glucose > config.maxGlucose) {
      logger.error(
        `Valor fuera del rango plausible (${config.minGlucose}-${config.maxGlucose} mg/dL): ` +
          `${reading.glucose}. No se inserta para no contaminar el historial.`
      );
      state.stats.failures += 1;
      return;
    }

    if (DRY_RUN) {
      logger.info('dry-run: no se escribe en la base de datos.');
      return;
    }

    const inserted = await withRetry(() => db.insertReading(reading), {
      attempts: 3,
      baseDelayMs: 2000,
      label: 'INSERT en Neon',
    });

    if (inserted) {
      state.stats.inserted += 1;
      logger.info(`Guardado en cgm_readings (total en esta sesión: ${state.stats.inserted}).`);
    } else {
      state.stats.duplicates += 1;
      logger.debug('Lectura ya registrada (mismo timestamp); no se duplica.');
    }
  } catch (err) {
    state.stats.failures += 1;

    if (err && err.fatal) {
      logger.error(`Error irrecuperable: ${logger.describeError(err)}`);
      await shutdown(db, 1);
      return;
    }

    logger.error(
      `Ciclo fallido: ${logger.describeError(err)}. ` +
        `Se reintenta en el próximo ciclo (${config.intervalMinutes} min).`
    );
  } finally {
    state.cycleInProgress = false;
  }
}

async function shutdown(db, code = 0) {
  if (state.shuttingDown) return;
  state.shuttingDown = true;

  if (state.timer) clearInterval(state.timer);

  const uptimeMin = Math.round((Date.now() - state.stats.startedAt) / 60000);
  logger.info(
    `Cerrando. Ciclos: ${state.stats.cycles} | Insertadas: ${state.stats.inserted} | ` +
      `Duplicadas: ${state.stats.duplicates} | Fallos: ${state.stats.failures} | Uptime: ${uptimeMin} min.`
  );

  if (db) await db.close();
  process.exit(code);
}

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error(logger.describeError(err));
    process.exit(1);
  }

  banner(config);

  const db = new Database(config);
  const libre = new LibreLinkUpClient(config.libre);

  // Un fallo aquí es de configuración: mejor morir ruidosamente al arrancar.
  try {
    await withRetry(() => db.init(), { attempts: 3, baseDelayMs: 2000, label: 'Conexión a Neon' });

    const last = await db.getLastReading();
    if (last) {
      const when = new Date(last.timestamp);
      logger.info(
        `Última lectura en la base: ${last.glucose_value} mg/dL ` +
          `(hace ${minutesAgo(when)} min).`
      );
    } else {
      logger.info('La tabla cgm_readings está vacía; esta será la primera lectura.');
    }

    await withRetry(() => libre.login(), {
      attempts: 3,
      baseDelayMs: 3000,
      label: 'Login en LibreLinkUp',
    });
  } catch (err) {
    logger.error(`No se pudo arrancar: ${logger.describeError(err)}`);
    await shutdown(db, 1);
    return;
  }

  // Señales del sistema (Ctrl+C, docker stop, systemd) -> cierre limpio.
  process.on('SIGINT', () => shutdown(db, 0));
  process.on('SIGTERM', () => shutdown(db, 0));

  process.on('unhandledRejection', (reason) => {
    // No matamos el worker: casi siempre es una promesa de red suelta.
    logger.error(`Promesa rechazada sin manejar: ${logger.describeError(reason)}`);
  });

  process.on('uncaughtException', async (err) => {
    logger.error(`Excepción no capturada: ${logger.describeError(err)}`);
    await shutdown(db, 1);
  });

  await runCycle(config, libre, db);

  if (RUN_ONCE) {
    if (DOCTOR) logger.info('Diagnóstico completo: credenciales, red y esquema funcionan.');
    await shutdown(db, state.stats.failures > 0 ? 1 : 0);
    return;
  }

  state.timer = setInterval(() => {
    runCycle(config, libre, db).catch((err) => {
      logger.error(`Error inesperado en el ciclo: ${logger.describeError(err)}`);
    });
  }, config.intervalMs);

  logger.info(`Worker activo. Próxima lectura en ${config.intervalMinutes} min. (Ctrl+C para salir)`);
}

main().catch((err) => {
  logger.error(`Fallo fatal en main(): ${logger.describeError(err)}`);
  process.exit(1);
});
// --- HACK PARA RENDER (SERVIDOR FANTASMA) ---
const http = require('http');
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('PancreasOS Worker Vivo y Coleando\n');
}).listen(port, () => {
  console.log(`[Web] Servidor fantasma encendido en el puerto ${port} para engañar a Render.`);
});
// --------------------------------------------