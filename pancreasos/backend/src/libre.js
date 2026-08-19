'use strict';

const crypto = require('node:crypto');
const axios = require('axios');

const { logger } = require('./logger');

const DEFAULT_HOST = 'api.libreview.io';

// La app de LibreLinkUp se identifica con estos headers. Si faltan, Abbott
// responde 401 aunque las credenciales sean correctas.
// --- MÁSCARA ANDROID 4.16.0 ---
const PRODUCT = 'llu.android';
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36';// ----------------------------------------
// Códigos de tendencia que devuelve Abbott en glucoseMeasurement.TrendArrow.
const TREND = {
  0: { name: 'NotComputable', glyph: '?' },
  1: { name: 'SingleDown', glyph: '↓' },
  2: { name: 'FortyFiveDown', glyph: '↘' },
  3: { name: 'Flat', glyph: '→' },
  4: { name: 'FortyFiveUp', glyph: '↗' },
  5: { name: 'SingleUp', glyph: '↑' },
};

// status != 0 en el cuerpo de la respuesta indica error de negocio.
const API_STATUS_BAD_CREDENTIALS = 2;
const API_STATUS_STEP_REQUIRED = 4;

class LibreError extends Error {
  constructor(message, { fatal = false, cause, httpStatus, apiStatus, retryAfterMs } = {}) {
    super(message, { cause });
    this.name = 'LibreError';
    this.fatal = fatal;
    if (httpStatus !== undefined) this.httpStatus = httpStatus;
    if (apiStatus !== undefined) this.apiStatus = apiStatus;
    if (retryAfterMs !== undefined) this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Los timestamps de LibreLinkUp llegan como "8/11/2026 3:57:00 AM".
 * FactoryTimestamp está en UTC; Timestamp está en hora local del paciente.
 * Siempre preferimos FactoryTimestamp para guardar un instante sin ambigüedad.
 */
function parseLibreTimestamp(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const text = raw.trim();

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?$/i.exec(
    text
  );

  if (match) {
    const [, month, day, year, rawHour, minute, second, meridiem] = match;
    let hour = Number(rawHour);
    if (meridiem) {
      const upper = meridiem.toUpperCase();
      if (upper === 'PM' && hour !== 12) hour += 12;
      if (upper === 'AM' && hour === 12) hour = 0;
    }
    const ms = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      hour,
      Number(minute),
      Number(second || 0)
    );
    const parsed = new Date(ms);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // Fallback por si Abbott cambia a ISO-8601 en el futuro.
  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Normaliza el valor a mg/dL sin importar en qué unidad venga la cuenta. */
function toMgPerDl(measurement) {
  const direct = Number(measurement.ValueInMgPerDl);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);

  const value = Number(measurement.Value);
  if (!Number.isFinite(value) || value <= 0) return null;

  // GlucoseUnits: 1 = mg/dL, 0 = mmol/L
  return measurement.GlucoseUnits === 0 ? Math.round(value * 18.0182) : Math.round(value);
}

class LibreLinkUpClient {
  #password;

  constructor(options) {
    this.email = options.email;
    this.#password = options.password;
    this.patientId = options.patientId || null;
    this.apiVersion = options.apiVersion;
    this.timeoutMs = options.timeoutMs;

    this.host = options.region ? `api-${options.region}.libreview.io` : DEFAULT_HOST;
    this.token = null;
    this.tokenExpiresAt = 0;
    this.accountIdHash = null;
  }

 #headers(extra = {}) {
    const headers = {
      accept: 'application/json',
      'accept-encoding': 'gzip',
      'cache-control': 'no-cache',
      connection: 'Keep-Alive',
      'content-type': 'application/json',
      product: PRODUCT,
      version: '4.16.0',
      'user-agent': USER_AGENT,
      ...extra,
    };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    // Requerido por Abbott desde 2025: Account-Id (Mayúsculas estrictas)
    if (this.accountIdHash) headers['Account-Id'] = this.accountIdHash;
    return headers;
  }
  async #request(method, path, { body, headers, host, bearer } = {}) {
    const targetHost = host || this.host;
    const url = `https://${targetHost}${path}`;
    const extra = { ...headers };
    if (bearer) extra.authorization = `Bearer ${bearer}`;

    let response;
    try {
      response = await axios({
        method,
        url,
        data: body,
        headers: this.#headers(extra),
        timeout: this.timeoutMs,
        validateStatus: () => true,
      });
    } catch (err) {
      throw new LibreError(`No se pudo contactar a LibreLinkUp (${targetHost})`, {
        cause: err,
      });
    }

    const { status, data } = response;

    // --- INICIO DEL CHISME ---
    if (status === 401 || status === 403) {
      console.log('\n--- EL CHISME DE ABBOTT (ERROR ' + status + ') ---');
      console.log(JSON.stringify(data, null, 2));
      console.log('-------------------------------------\n');
    }
    // --- FIN DEL CHISME ---

    if (status === 401 || status === 403) {
      this.token = null;
      this.tokenExpiresAt = 0;
      throw new LibreError(
        `LibreLinkUp rechazó la sesión (HTTP ${status}). Se reintentará autenticando de nuevo. Si persiste, revisa LIBRE_API_VERSION.`,
        { httpStatus: status }
      );
    }

    if (status === 429 || status >= 500) {
      const retryAfter = Number(response.headers?.['retry-after']);
      throw new LibreError(
        `LibreLinkUp respondió HTTP ${status} (${status === 429 ? 'rate limit' : 'error del servidor'})`,
        {
          httpStatus: status,
          retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
        }
      );
    }

    if (status >= 400) {
      throw new LibreError(`LibreLinkUp respondió HTTP ${status} en ${path}`, {
        httpStatus: status,
      });
    }

    if (!data || typeof data !== 'object') {
      throw new LibreError(`Respuesta inesperada de LibreLinkUp en ${path}`, {
        httpStatus: status,
      });
    }

    return data;
  }
  async login() {
    let host = this.host;

    for (let hop = 0; hop < 3; hop += 1) {
      const payload = await this.#request('post', '/llu/auth/login', {
        host,
        body: { email: this.email, password: this.#password },
      });

      // La cuenta pertenece a otra región: repetimos el login allá.
      const region = payload.data?.region;
      if (payload.data?.redirect && region) {
        host = `api-${region}.libreview.io`;
        logger.info(`LibreLinkUp: la cuenta vive en la región "${region}", redirigiendo a ${host}.`);
        continue;
      }

      if (payload.status === API_STATUS_BAD_CREDENTIALS) {
        throw new LibreError(
          'Credenciales de LibreLinkUp inválidas. Revisa LIBRE_EMAIL y LIBRE_PASSWORD.',
          { fatal: true, apiStatus: payload.status }
        );
      }

      if (payload.status === API_STATUS_STEP_REQUIRED && payload.data?.step?.type) {
        const ticket = await this.#acceptPendingStep(host, payload);
        this.#storeSession(host, ticket.authTicket, ticket.user);
        return;
      }

      if (payload.status !== 0) {
        throw new LibreError(
          `LibreLinkUp rechazó el login (status=${payload.status}). ` +
            `${payload.error?.message || 'Sin detalle del servidor.'}`,
          { apiStatus: payload.status }
        );
      }

      if (!payload.data?.authTicket?.token) {
        throw new LibreError('LibreLinkUp no devolvió token de sesión.', {
          apiStatus: payload.status,
        });
      }

      this.#storeSession(host, payload.data.authTicket, payload.data.user);
      return;
    }

    throw new LibreError('Demasiados redirects de región en el login de LibreLinkUp.');
  }

  /**
   * Abbott bloquea la cuenta hasta aceptar términos de uso / privacidad.
   * Lo resolvemos automáticamente; si falla, el usuario debe abrir la app.
   */
  async #acceptPendingStep(host, payload) {
    const stepType = payload.data.step.type; // 'tou' | 'pp' | ...
    const tempToken = payload.data?.authTicket?.token;

    if (!tempToken) {
      throw new LibreError(
        `LibreLinkUp requiere aceptar "${stepType}". Abre la app de LibreLinkUp con esta cuenta y acéptalo.`,
        { fatal: true, apiStatus: payload.status }
      );
    }

    logger.warn(`LibreLinkUp pide aceptar "${stepType}". Intentando aceptarlo automáticamente...`);

    const result = await this.#request('post', `/auth/continue/${stepType}`, {
      host,
      bearer: tempToken,
    });

    if (result.status !== 0 || !result.data?.authTicket?.token) {
      throw new LibreError(
        `No se pudo aceptar "${stepType}" automáticamente. Abre la app de LibreLinkUp con esta cuenta y acéptalo a mano.`,
        { fatal: true, apiStatus: result.status }
      );
    }

    logger.info(`LibreLinkUp: "${stepType}" aceptado correctamente.`);
    return result.data;
  }

  #storeSession(host, authTicket, user) {
    this.host = host;
    this.token = authTicket.token;

    // `expires` viene en segundos epoch. Restamos 5 min de margen.
    const expiresSec = Number(authTicket.expires);
    this.tokenExpiresAt = Number.isFinite(expiresSec) && expiresSec > 0
      ? expiresSec * 1000 - 5 * 60 * 1000
      : Date.now() + 50 * 60 * 1000;

   this.accountIdHash = user?.id
  ? crypto.createHash('sha256').update(String(user.id)).digest('hex')
  : null;

    if (!this.accountIdHash) {
      logger.warn('LibreLinkUp no devolvió user.id; se omite el header Account-Id.');
    }
    logger.info(`LibreLinkUp: sesión iniciada en ${host}.`);
  }

  async ensureSession() {
    if (!this.token || Date.now() >= this.tokenExpiresAt) {
      await this.login();
    }
  }

  /** Lista de pacientes que comparten datos con esta cuenta. */
  async getConnections() {
    await this.ensureSession();
    const payload = await this.#request('get', '/llu/connections');

    if (payload.status !== 0) {
      throw new LibreError(`LibreLinkUp devolvió status=${payload.status} en /llu/connections`, {
        apiStatus: payload.status,
      });
    }
    return Array.isArray(payload.data) ? payload.data : [];
  }

  #pickConnection(connections) {
    if (connections.length === 0) {
      // No es fatal: puede resolverse aceptando la invitación sin reiniciar.
      throw new LibreError(
        'La cuenta de LibreLinkUp no tiene pacientes vinculados. ' +
          'Verifica que la invitación para compartir esté aceptada en la app.'
      );
    }

    if (this.patientId) {
      const match = connections.find((c) => c.patientId === this.patientId);
      if (!match) {
        const ids = connections.map((c) => c.patientId).join(', ');
        throw new LibreError(
          `LIBRE_PATIENT_ID="${this.patientId}" no está entre los pacientes vinculados (${ids}).`,
          { fatal: true }
        );
      }
      return match;
    }

    if (connections.length > 1) {
      const detail = connections
        .map((c) => `${c.firstName || '?'} ${c.lastName || ''} -> ${c.patientId}`)
        .join(' | ');
      throw new LibreError(
        `La cuenta sigue a ${connections.length} pacientes. Define LIBRE_PATIENT_ID en el .env. Opciones: ${detail}`,
        { fatal: true }
      );
    }

    return connections[0];
  }

  /**
   * Devuelve la lectura actual normalizada, o null si el sensor todavía no
   * reporta una medición válida (calentamiento, sensor caído, etc.).
   */
  async getLatestReading() {
    const connection = this.#pickConnection(await this.getConnections());
    const measurement = connection.glucoseMeasurement;

    if (!measurement) {
      logger.warn(
        `El paciente ${connection.firstName || connection.patientId} no tiene medición activa ` +
          '(sensor en calentamiento o fuera de rango).'
      );
      return null;
    }

    const glucose = toMgPerDl(measurement);
    const timestamp =
      parseLibreTimestamp(measurement.FactoryTimestamp) ||
      parseLibreTimestamp(measurement.Timestamp);

    if (glucose === null || !timestamp) {
      throw new LibreError(
        `No se pudo interpretar la medición de LibreLinkUp ` +
          `(value=${measurement.ValueInMgPerDl ?? measurement.Value}, ts=${measurement.FactoryTimestamp}).`
      );
    }

    const trendCode = Number.isFinite(Number(measurement.TrendArrow))
      ? Number(measurement.TrendArrow)
      : 0;
    const trend = TREND[trendCode] || TREND[0];

    return {
      glucose,
      trendCode,
      trendName: trend.name,
      trendGlyph: trend.glyph,
      timestamp,
      isHigh: Boolean(measurement.isHigh),
      isLow: Boolean(measurement.isLow),
      patientId: connection.patientId,
      patientName: [connection.firstName, connection.lastName].filter(Boolean).join(' ') || null,
    };
  }
}

module.exports = { LibreLinkUpClient, LibreError, TREND, parseLibreTimestamp, toMgPerDl };
