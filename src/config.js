'use strict';

const path = require('node:path');
const dotenv = require('dotenv');

const { logger } = require('./logger');

// Carga .env desde la raiz del servicio, sin importar desde donde se invoque node.
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
    this.fatal = true;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new ConfigError(
      `Falta la variable de entorno ${name}. Copia .env.example a .env y complétala.`
    );
  }
  return value.trim();
}

function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function number(name, fallback, { min, max } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new ConfigError(`${name} debe ser numérico, se recibió "${raw}".`);
  }
  if (min !== undefined && value < min) {
    throw new ConfigError(`${name} debe ser >= ${min}, se recibió ${value}.`);
  }
  if (max !== undefined && value > max) {
    throw new ConfigError(`${name} debe ser <= ${max}, se recibió ${value}.`);
  }
  return value;
}

function boolean(name, fallback = false) {
  const raw = optional(name);
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(raw.toLowerCase());
}

function load() {
  const cfg = {
    databaseUrl: required('DATABASE_URL'),

    libre: {
      email: required('LIBRE_EMAIL'),
      password: required('LIBRE_PASSWORD'),
      // Opcional: si se omite, el login detecta la región automáticamente
      // siguiendo el redirect que devuelve Abbott.
      region: optional('LIBRE_REGION'),
      // Necesario solo si la cuenta sigue a más de un paciente.
      patientId: optional('LIBRE_PATIENT_ID'),
      // Abbott rechaza versiones viejas del cliente. Si algún día empieza a
      // responder 401/426, sube este valor en el .env sin tocar el código.
      apiVersion: optional('LIBRE_API_VERSION', '4.12.0'),
      timeoutMs: number('HTTP_TIMEOUT_MS', 20000, { min: 1000, max: 120000 }),
    },

    // Se usa solo si la tabla cgm_readings tiene columna user_id.
    patientUserId: optional('PATIENT_USER_ID'),

    intervalMinutes: number('SYNC_INTERVAL_MINUTES', 5, { min: 1, max: 60 }),
    logLevel: optional('LOG_LEVEL', 'info'),

    // Escotilla de emergencia para redes con proxy TLS que rompe la cadena
    // de certificados. No debería hacer falta con Neon.
    pgNoVerifyTls: boolean('PGSSL_NO_VERIFY', false),

    // Rango fisiológicamente posible; fuera de esto asumimos error de parseo
    // y no ensuciamos la base con datos que luego alimentarán el análisis.
    minGlucose: number('MIN_GLUCOSE_MGDL', 20, { min: 1, max: 100 }),
    maxGlucose: number('MAX_GLUCOSE_MGDL', 600, { min: 200, max: 2000 }),
  };

  cfg.intervalMs = Math.round(cfg.intervalMinutes * 60 * 1000);
  logger.setLevel(cfg.logLevel);
  return cfg;
}

module.exports = { load, ConfigError };
