require('dotenv').config();
const express = require('express');
const db = require('./db');
const {
  PORT,
  NODE_ENV,
  API_KEY,
  JSON_BODY_LIMIT,
  SHUTDOWN_TIMEOUT_MS,
  CORS_ALLOWED_ORIGINS,
  assertStartupConfig,
} = require('./src/config');
const { createAuthenticateMiddleware } = require('./src/middlewares/authenticate');
const authService = require('./src/services/authService');
const { registerAuthRoutes } = require('./src/routes/authRoutes');
const { registerMatchRoutes } = require('./src/routes/matchRoutes');
const { registerAnalysisConfigRoutes } = require('./src/routes/analysisConfigRoutes');
const { registerHubRoutes } = require('./src/routes/hubRoutes');
const { registerAdminRoutes } = require('./src/routes/adminRoutes');
const { startDatasourceCollectionScheduler } = require('./src/services/datasourceCollectionScheduler');

let cors;
try {
  cors = require('cors');
} catch (error) {
  cors = () => (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  };
}

const CORS_FORBIDDEN_MESSAGE = 'CORS_ORIGIN_FORBIDDEN';

function applySecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

function createFallbackCorsMiddleware() {
  const allowsAnyOrigin = CORS_ALLOWED_ORIGINS.includes('*');
  const allowedOrigins = new Set(CORS_ALLOWED_ORIGINS);

  return (req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (allowsAnyOrigin) {
      res.header('Access-Control-Allow-Origin', '*');
    } else if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
      res.header('Access-Control-Allow-Origin', requestOrigin || 'null');
      res.header('Vary', 'Origin');
    } else {
      return res.status(403).json({
        error: {
          code: 'CORS_FORBIDDEN',
          message: 'Origin is not allowed',
        },
      });
    }

    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    );
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  };
}

function createCorsMiddleware() {
  if (typeof cors !== 'function') {
    return createFallbackCorsMiddleware();
  }

  if (CORS_ALLOWED_ORIGINS.includes('*')) {
    return cors();
  }

  const allowedOrigins = new Set(CORS_ALLOWED_ORIGINS);
  return cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(CORS_FORBIDDEN_MESSAGE));
    },
    credentials: true,
  });
}

async function buildReadinessPayload() {
  const dbState = await db.ping();
  return {
    status: dbState.ok ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    nodeEnv: NODE_ENV,
    checks: {
      database: dbState,
    },
  };
}

function createApp() {
  const app = express();
  const authenticate = createAuthenticateMiddleware({
    apiKey: API_KEY,
    authService,
  });

  app.use(applySecurityHeaders);
  app.use(createCorsMiddleware());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  registerAuthRoutes(app, { authService });
  registerMatchRoutes(app, authenticate);
  registerAnalysisConfigRoutes(app, authenticate);
  registerHubRoutes(app, authenticate);
  registerAdminRoutes(app, authenticate);

  app.get('/health', async (req, res) => {
    const readiness = await buildReadinessPayload();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db_connected: db.isConnected(),
      db_ready: readiness.checks.database.ok,
    });
  });

  app.get('/livez', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      nodeEnv: NODE_ENV,
    });
  });

  app.get('/readyz', async (req, res) => {
    const payload = await buildReadinessPayload();
    return res.status(payload.status === 'ready' ? 200 : 503).json(payload);
  });

  app.use((error, req, res, next) => {
    if (error && error.message === CORS_FORBIDDEN_MESSAGE) {
      return res.status(403).json({
        error: {
          code: 'CORS_FORBIDDEN',
          message: 'Origin is not allowed',
        },
      });
    }
    return next(error);
  });

  return app;
}

function installGracefulShutdown(server, options = {}) {
  const timeoutMs = Number.isFinite(options?.timeoutMs)
    ? options.timeoutMs
    : SHUTDOWN_TIMEOUT_MS;
  const beforeShutdown =
    typeof options?.beforeShutdown === 'function' ? options.beforeShutdown : null;
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    console.log(`[shutdown] received ${signal}, closing http server`);

    const forceExitTimer = setTimeout(() => {
      console.error('[shutdown] timeout exceeded, forcing exit');
      process.exit(1);
    }, timeoutMs);
    forceExitTimer.unref();

    server.close(async (error) => {
      clearTimeout(forceExitTimer);

      try {
        if (beforeShutdown) {
          await beforeShutdown();
        }
      } catch (hookError) {
        console.error('[shutdown] pre-shutdown hook failed', hookError.message);
        process.exit(1);
        return;
      }

      try {
        await db.close();
      } catch (closeError) {
        console.error('[shutdown] failed to close database pool', closeError.message);
        process.exit(1);
        return;
      }

      if (error) {
        console.error('[shutdown] server close failed', error.message);
        process.exit(1);
        return;
      }

      console.log('[shutdown] graceful shutdown complete');
      process.exit(0);
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

function startServer(port = PORT, options = {}) {
  const startupReport = assertStartupConfig();
  startupReport.warnings.forEach((warning) => {
    console.warn(`[startup-warning] ${warning}`);
  });

  const shouldEnableCollectionScheduler =
    options.enableCollectionScheduler === true
    || String(process.env.ENABLE_COLLECTION_SCHEDULER || '').trim().toLowerCase() === 'true';
  let stopCollectionScheduler = null;
  if (shouldEnableCollectionScheduler) {
    stopCollectionScheduler = startDatasourceCollectionScheduler({
      tenantId: options.collectionSchedulerTenantId,
    });
  }

  const app = createApp();
  const server = app.listen(port, () => {
    const address = server.address();
    const resolvedPort =
      address && typeof address === 'object' && address.port ? address.port : port;
    console.log(`Match Data Server running on port ${resolvedPort}`);
    console.log(`API Key configured: ${API_KEY.substring(0, 4)}...`);
    console.log(
      `Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Not Configured (Using Mock Data)'}`,
    );
  });

  if (options.installSignalHandlers === true) {
    installGracefulShutdown(server, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
      beforeShutdown: async () => {
        if (typeof stopCollectionScheduler === 'function') {
          await stopCollectionScheduler();
        }
      },
    });
  }

  return { app, server, startupReport, stopCollectionScheduler };
}

if (require.main === module) {
  startServer(PORT, { installSignalHandlers: true });
}

module.exports = {
  createApp,
  startServer,
  buildReadinessPayload,
};
