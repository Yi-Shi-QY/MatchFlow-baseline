let pool = null;

function parseIntegerEnv(name, fallbackValue) {
  const rawValue = process.env[name];
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function readBooleanEnv(name, fallbackValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined) {
    return fallbackValue;
  }

  const normalized = String(rawValue).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return fallbackValue;
}

function resolveDbSslConfig() {
  const sslMode = String(
    process.env.DB_SSL_MODE || (process.env.NODE_ENV === 'production' ? 'require' : 'disable'),
  )
    .trim()
    .toLowerCase();

  if (sslMode === 'disable' || sslMode === 'off' || sslMode === 'false') {
    return false;
  }

  const rejectUnauthorized = readBooleanEnv('DB_SSL_REJECT_UNAUTHORIZED', true);
  return {
    rejectUnauthorized,
  };
}

function createPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const { Pool } = require('pg');
    const instance = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseIntegerEnv('DB_POOL_MAX', 20),
      idleTimeoutMillis: parseIntegerEnv('DB_POOL_IDLE_TIMEOUT_MS', 30_000),
      connectionTimeoutMillis: parseIntegerEnv('DB_POOL_CONNECT_TIMEOUT_MS', 5_000),
      ssl: resolveDbSslConfig(),
    });

    instance.on('error', (error) => {
      console.error('[db] unexpected pool error', error.message);
    });

    return instance;
  } catch (error) {
    console.error('DATABASE_URL is set but pg dependency is missing. Falling back to mock mode.');
    return null;
  }
}

pool = createPool();

async function query(text, params) {
  if (!pool) {
    return null;
  }
  return pool.query(text, params);
}

async function ping() {
  if (!pool) {
    return {
      ok: false,
      code: 'DB_NOT_CONFIGURED',
      message: 'Database URL is not configured',
    };
  }

  try {
    await pool.query('SELECT 1');
    return {
      ok: true,
      code: 'DB_OK',
      message: 'Database is reachable',
    };
  } catch (error) {
    return {
      ok: false,
      code: 'DB_UNREACHABLE',
      message: error?.message || 'Database ping failed',
    };
  }
}

async function close() {
  if (!pool) {
    return;
  }
  const currentPool = pool;
  pool = null;
  await currentPool.end();
}

module.exports = {
  query,
  ping,
  close,
  isConnected: () => !!pool,
};
