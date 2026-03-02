const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'your-secret-key';

function parseIntegerEnv(name, fallbackValue) {
  const rawValue = process.env[name];
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || API_KEY;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || `${API_KEY}-refresh`;
const ACCESS_TOKEN_TTL_SECONDS = parseIntegerEnv('ACCESS_TOKEN_TTL_SECONDS', 15 * 60);
const REFRESH_TOKEN_TTL_SECONDS = parseIntegerEnv('REFRESH_TOKEN_TTL_SECONDS', 7 * 24 * 60 * 60);

module.exports = {
  PORT,
  API_KEY,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
};
