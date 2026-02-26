const { Pool } = require('pg');

let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

module.exports = {
  query: (text, params) => {
    if (!pool) return null;
    return pool.query(text, params);
  },
  isConnected: () => !!pool
};
