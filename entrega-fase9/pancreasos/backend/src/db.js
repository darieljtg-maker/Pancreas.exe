'use strict';

const { Pool } = require('pg');

const { logger } = require('./logger');

const TABLE = 'cgm_readings';

class DbError extends Error {
  constructor(message, { fatal = false, cause } = {}) {
    super(message, { cause });
    this.name = 'DbError';
    this.fatal = fatal;
  }
}

/**
 * Neon exige TLS. Lo activamos explícitamente en vez de confiar en el
 * sslmode del connection string, que se ha interpretado distinto según
 * la versión de node-postgres.
 */
function sslConfigFor(connectionString, { noVerify }) {
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
  const sslDisabled = /[?&]sslmode=disable\b/.test(connectionString);

  if (isLocal || sslDisabled) return false;
  return { rejectUnauthorized: !noVerify };
}

const quote = (identifier) => `"${String(identifier).replace(/"/g, '""')}"`;

// Errores de Postgres que reintentar no arregla: son de configuración.
const FATAL_PG_CODES = new Set([
  '3D000', // la base de datos no existe
  '28P01', // password incorrecto
  '28000', // autorización inválida
  '42P01', // tabla inexistente
  '42501', // permisos insuficientes
]);

/**
 * Cada parámetro se castea al tipo real de su columna. Sin esto, Postgres
 * no siempre infiere el tipo dentro de un INSERT ... SELECT.
 */
function castFor(dataType) {
  switch (dataType) {
    case 'smallint':
    case 'integer':
    case 'bigint':
    case 'numeric':
    case 'real':
    case 'double precision':
    case 'uuid':
    case 'date':
    case 'boolean':
      return dataType;
    case 'timestamp with time zone':
      return 'timestamptz';
    case 'timestamp without time zone':
      return 'timestamp';
    default:
      return 'text';
  }
}

class Database {
  constructor(config) {
    this.config = config;
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: sslConfigFor(config.databaseUrl, { noVerify: config.pgNoVerifyTls }),
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      // Neon suspende las conexiones ociosas; un keepalive evita
      // sockets muertos entre ciclos de 5 minutos.
      keepAlive: true,
      application_name: 'pancreasos-cgm-sync',
    });

    // Sin este handler, un error en un cliente ocioso tumba el proceso.
    this.pool.on('error', (err) => {
      logger.warn(`Cliente ocioso de Postgres falló: ${logger.describeError(err)}`);
    });

    this.schema = null;
    this.columns = null;
    this.insertPlan = null;
  }

  async close() {
    await this.pool.end().catch(() => {});
  }

  /**
   * Lee el esquema real de cgm_readings y arma el INSERT en consecuencia.
   * Así el worker sigue funcionando si mañana añades columnas a la tabla.
   */
  async init() {
    let result;
    try {
      result = await this.pool.query(
        `SELECT table_schema, column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_name = $1
            AND table_schema = ANY (current_schemas(false))
          ORDER BY ordinal_position`,
        [TABLE]
      );
    } catch (err) {
      throw new DbError(`No se pudo conectar a Neon: ${err.message}`, {
        cause: err,
        fatal: FATAL_PG_CODES.has(err.code),
      });
    }

    if (result.rows.length === 0) {
      throw new DbError(
        `La tabla "${TABLE}" no existe en la base de datos (search_path actual). ` +
          'Revisa que DATABASE_URL apunte a la base correcta.',
        { fatal: true }
      );
    }

    this.schema = result.rows[0].table_schema;
    this.columns = new Map(result.rows.map((row) => [row.column_name, row]));
    this.insertPlan = this.#buildInsertPlan();

    logger.info(
      `Neon conectado. Tabla ${this.schema}.${TABLE} con columnas: ` +
        `${[...this.columns.keys()].join(', ')}.`
    );
    return this.insertPlan;
  }

  #buildInsertPlan() {
    for (const name of ['glucose_value', 'timestamp']) {
      if (!this.columns.has(name)) {
        throw new DbError(
          `La tabla ${TABLE} no tiene la columna obligatoria "${name}".`,
          { fatal: true }
        );
      }
    }

    const fields = [];
    const push = (column, source) =>
      fields.push({ column, source, cast: castFor(this.columns.get(column).data_type) });

    push('glucose_value', 'glucose');

    if (this.columns.has('trend_arrow')) {
      push('trend_arrow', 'trend');
    } else {
      logger.warn(`La tabla ${TABLE} no tiene columna "trend_arrow"; la tendencia no se guardará.`);
    }

    push('timestamp', 'timestamp');

    // La tabla puede o no tener user_id; nos adaptamos a lo que exista.
    if (this.columns.has('user_id')) {
      const column = this.columns.get('user_id');
      if (this.config.patientUserId) {
        push('user_id', 'userId');
      } else if (column.is_nullable === 'NO' && !column.column_default) {
        throw new DbError(
          `${TABLE}.user_id es NOT NULL pero PATIENT_USER_ID no está definido en el .env.`,
          { fatal: true }
        );
      } else {
        logger.warn(
          `${TABLE} tiene columna user_id pero PATIENT_USER_ID no está definido; se insertará NULL.`
        );
      }
    } else if (this.config.patientUserId) {
      logger.warn(`PATIENT_USER_ID está definido pero ${TABLE} no tiene columna user_id; se ignora.`);
    }

    // Cualquier otra columna NOT NULL sin default haría fallar todos los
    // INSERT. Mejor detectarlo al arrancar que cada 5 minutos.
    const filled = new Set(fields.map((f) => f.column));
    const blockers = [...this.columns.values()].filter(
      (col) =>
        !filled.has(col.column_name) &&
        col.is_nullable === 'NO' &&
        !col.column_default
    );

    if (blockers.length > 0) {
      throw new DbError(
        `${TABLE} tiene columnas NOT NULL sin valor por defecto que este worker no llena: ` +
          `${blockers.map((c) => c.column_name).join(', ')}. Dales un DEFAULT o hazlas nullable.`,
        { fatal: true }
      );
    }

    const table = `${quote(this.schema)}.${quote(TABLE)}`;
    const placeholders = fields.map((field, index) => {
      const param = `$${index + 1}::${field.cast}`;
      // Un timestamp sin zona horaria se guarda en UTC, no en hora local
      // del servidor, para que el instante nunca sea ambiguo.
      return field.column === 'timestamp' && field.cast === 'timestamp'
        ? `($${index + 1}::timestamptz AT TIME ZONE 'UTC')`
        : param;
    });

    const timestampIndex = fields.findIndex((f) => f.column === 'timestamp');
    const userIdIndex = fields.findIndex((f) => f.column === 'user_id');

    // Sin restricción UNIQUE en la tabla, el propio INSERT evita duplicados:
    // si ya existe una lectura con ese timestamp, no inserta nada.
    const dedupe = [`${quote('timestamp')} = ${placeholders[timestampIndex]}`];
    if (userIdIndex >= 0) {
      dedupe.push(`${quote('user_id')} = ${placeholders[userIdIndex]}`);
    }

    const returning = this.columns.has('id') ? ` RETURNING ${quote('id')}` : '';

    const text =
      `INSERT INTO ${table} (${fields.map((f) => quote(f.column)).join(', ')})\n` +
      `SELECT ${placeholders.join(', ')}\n` +
      `WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE ${dedupe.join(' AND ')})${returning}`;

    return { text, fields };
  }

  #valuesFor(reading) {
    return this.insertPlan.fields.map((field) => {
      switch (field.source) {
        case 'glucose':
          return reading.glucose;
        case 'trend':
          // Si la columna es numérica guardamos el código de Abbott;
          // si es texto, el nombre legible ("Flat", "FortyFiveUp"...).
          return field.cast === 'text' ? reading.trendName : reading.trendCode;
        case 'timestamp':
          return reading.timestamp.toISOString();
        case 'userId':
          return this.config.patientUserId;
        default:
          return null;
      }
    });
  }

  /** Inserta la lectura. Devuelve false si ya estaba registrada. */
  async insertReading(reading) {
    if (!this.insertPlan) throw new DbError('La base de datos no fue inicializada.');

    try {
      const result = await this.pool.query(this.insertPlan.text, this.#valuesFor(reading));
      return result.rowCount > 0;
    } catch (err) {
      // 23xxx = violaciones de integridad: reintentar no ayuda.
      const fatal = typeof err.code === 'string' && err.code.startsWith('23');
      throw new DbError(`Falló el INSERT en ${TABLE}: ${err.message}`, { fatal, cause: err });
    }
  }

  /** Última lectura guardada, para el resumen de arranque. */
  async getLastReading() {
    const table = `${quote(this.schema)}.${quote(TABLE)}`;
    const result = await this.pool.query(
      `SELECT * FROM ${table} ORDER BY ${quote('timestamp')} DESC LIMIT 1`
    );
    return result.rows[0] || null;
  }
}

module.exports = { Database, DbError, TABLE };
