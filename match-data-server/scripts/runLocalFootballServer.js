const DEFAULTS = {
  PORT: '3001',
  NODE_ENV: 'development',
  API_KEY: 'matchflow-local-football-test-key-20260311',
  ACCESS_TOKEN_SECRET: 'matchflow-local-football-access-secret-20260311',
  REFRESH_TOKEN_SECRET: 'matchflow-local-football-refresh-secret-20260311',
  CORS_ALLOWED_ORIGINS: '*',
  DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/matchflow',
  DB_SSL_MODE: 'disable',
};

Object.entries(DEFAULTS).forEach(([name, value]) => {
  if (!process.env[name]) {
    process.env[name] = value;
  }
});

const { startServer } = require('../index');

console.log('[local-football] starting server with local Postgres defaults');
console.log(`[local-football] base url: http://127.0.0.1:${process.env.PORT}`);
console.log(`[local-football] api key: ${process.env.API_KEY}`);
console.log(`[local-football] database: ${process.env.DATABASE_URL}`);

startServer(Number(process.env.PORT), { installSignalHandlers: true });
