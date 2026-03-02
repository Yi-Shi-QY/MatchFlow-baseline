const DEFAULT_API_KEY = 'your-secret-key';

function normalizeEnvText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function parseIntegerEnv(name, fallbackValue) {
  const rawValue = process.env[name];
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function parseCsvEnv(name, fallbackValue) {
  const rawValue = process.env[name];
  const resolved = rawValue === undefined ? fallbackValue : rawValue;
  return String(resolved || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

const PORT = parseIntegerEnv('PORT', 3001);
const NODE_ENV = normalizeEnvText(process.env.NODE_ENV) || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const API_KEY = normalizeEnvText(process.env.API_KEY) || DEFAULT_API_KEY;
const ACCESS_TOKEN_SECRET = normalizeEnvText(process.env.ACCESS_TOKEN_SECRET) || API_KEY;
const REFRESH_TOKEN_SECRET =
  normalizeEnvText(process.env.REFRESH_TOKEN_SECRET) || `${API_KEY}-refresh`;
const ACCESS_TOKEN_TTL_SECONDS = parseIntegerEnv('ACCESS_TOKEN_TTL_SECONDS', 15 * 60);
const REFRESH_TOKEN_TTL_SECONDS = parseIntegerEnv(
  'REFRESH_TOKEN_TTL_SECONDS',
  7 * 24 * 60 * 60,
);
const JSON_BODY_LIMIT = normalizeEnvText(process.env.JSON_BODY_LIMIT) || '1mb';
const SHUTDOWN_TIMEOUT_MS = parseIntegerEnv('SHUTDOWN_TIMEOUT_MS', 10_000);
const CORS_ALLOWED_ORIGINS = parseCsvEnv('CORS_ALLOWED_ORIGINS', '*');

function validateSecretLength(secretValue, secretName, report, mode) {
  if (secretValue.length >= 32) {
    return;
  }
  const message = `${secretName} should be at least 32 characters`;
  if (mode === 'production') {
    report.errors.push(message);
  } else {
    report.warnings.push(message);
  }
}

function buildStartupValidationReport(options = {}) {
  const mode = normalizeEnvText(options.nodeEnv || NODE_ENV) || 'development';
  const isProductionMode = mode === 'production';
  const apiKey = normalizeEnvText(options.apiKey || API_KEY);
  const accessTokenSecret = normalizeEnvText(options.accessTokenSecret || ACCESS_TOKEN_SECRET);
  const refreshTokenSecret = normalizeEnvText(options.refreshTokenSecret || REFRESH_TOKEN_SECRET);
  const databaseUrl = normalizeEnvText(options.databaseUrl || process.env.DATABASE_URL);
  const corsAllowedOrigins = Array.isArray(options.corsAllowedOrigins)
    ? options.corsAllowedOrigins
    : CORS_ALLOWED_ORIGINS;

  const report = {
    mode,
    errors: [],
    warnings: [],
  };

  if (!apiKey) {
    report.errors.push('API_KEY is required');
  } else {
    if (apiKey === DEFAULT_API_KEY) {
      if (isProductionMode) {
        report.errors.push('API_KEY cannot use the default placeholder in production');
      } else {
        report.warnings.push('API_KEY is using default placeholder');
      }
    }

    if (apiKey.length < 24) {
      const message = 'API_KEY should be at least 24 characters';
      if (isProductionMode) {
        report.errors.push(message);
      } else {
        report.warnings.push(message);
      }
    }
  }

  validateSecretLength(accessTokenSecret, 'ACCESS_TOKEN_SECRET', report, mode);
  validateSecretLength(refreshTokenSecret, 'REFRESH_TOKEN_SECRET', report, mode);

  if (accessTokenSecret === API_KEY) {
    const message = 'ACCESS_TOKEN_SECRET should not equal API_KEY';
    if (isProductionMode) {
      report.errors.push(message);
    } else {
      report.warnings.push(message);
    }
  }

  if (refreshTokenSecret === `${API_KEY}-refresh`) {
    const message = 'REFRESH_TOKEN_SECRET should not be derived from API_KEY';
    if (isProductionMode) {
      report.errors.push(message);
    } else {
      report.warnings.push(message);
    }
  }

  if (accessTokenSecret === refreshTokenSecret) {
    const message = 'ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET should be different values';
    if (isProductionMode) {
      report.errors.push(message);
    } else {
      report.warnings.push(message);
    }
  }

  if (!databaseUrl) {
    const message = 'DATABASE_URL is not configured';
    if (isProductionMode) {
      report.errors.push(message);
    } else {
      report.warnings.push(`${message}, server runs in mock mode`);
    }
  }

  if (isProductionMode && corsAllowedOrigins.includes('*')) {
    report.warnings.push('CORS_ALLOWED_ORIGINS includes wildcard (*), verify this is intentional');
  }

  return report;
}

function assertStartupConfig(options = {}) {
  const report = buildStartupValidationReport(options);
  if (report.errors.length === 0) {
    return report;
  }

  const detail = report.errors.map((error) => `- ${error}`).join('\n');
  throw new Error(`Startup configuration validation failed:\n${detail}`);
}

module.exports = {
  DEFAULT_API_KEY,
  PORT,
  NODE_ENV,
  IS_PRODUCTION,
  API_KEY,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  JSON_BODY_LIMIT,
  SHUTDOWN_TIMEOUT_MS,
  CORS_ALLOWED_ORIGINS,
  buildStartupValidationReport,
  assertStartupConfig,
};
