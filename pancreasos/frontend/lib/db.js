import { Pool } from 'pg';
import { TZ } from './config';

/**
 * Pool de conexiones a Neon.
 *
 * En Vercel cada función serverless mantiene su propio pool, por eso `max` es
 * bajo y hay que usar el endpoint *-pooler* de Neon en DATABASE_URL.
 * Se cachea en globalThis para no abrir un pool nuevo en cada hot-reload.
 */

const globalForDb = globalThis;

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL. Copia .env.example a .env.local y complétala.');
  }

  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);

  return new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: true },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    application_name: 'pancreasos-web',
  });
}

export function getPool() {
  if (!globalForDb.__pancreasPool) {
    globalForDb.__pancreasPool = createPool();
    globalForDb.__pancreasPool.on('error', (err) => {
      console.error('[db] cliente ocioso falló:', err.message);
    });
  }
  return globalForDb.__pancreasPool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export { TZ };

/** Inicio del día local, como expresión SQL reutilizable. */
export const INICIO_DEL_DIA = `(date_trunc('day', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}')`;
