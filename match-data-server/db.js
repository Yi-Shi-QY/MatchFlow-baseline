let pool;

if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  } catch (error) {
    console.error('DATABASE_URL is set but pg dependency is missing. Falling back to mock mode.');
    pool = null;
  }
}

module.exports = {
  query: (text, params) => {
    if (!pool) return null;
    return pool.query(text, params);
  },
  isConnected: () => !!pool
};
