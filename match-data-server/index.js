require('dotenv').config();
const express = require('express');
const db = require('./db');
const { PORT, API_KEY } = require('./src/config');
const { createAuthenticateMiddleware } = require('./src/middlewares/authenticate');
const authService = require('./src/services/authService');
const { registerAuthRoutes } = require('./src/routes/authRoutes');
const { registerMatchRoutes } = require('./src/routes/matchRoutes');
const { registerAnalysisConfigRoutes } = require('./src/routes/analysisConfigRoutes');
const { registerHubRoutes } = require('./src/routes/hubRoutes');
const { registerAdminRoutes } = require('./src/routes/adminRoutes');

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

function createApp() {
  const app = express();
  const authenticate = createAuthenticateMiddleware({
    apiKey: API_KEY,
    authService,
  });

  app.use(cors());
  app.use(express.json());

  registerAuthRoutes(app, { authService });
  registerMatchRoutes(app, authenticate);
  registerAnalysisConfigRoutes(app, authenticate);
  registerHubRoutes(app, authenticate);
  registerAdminRoutes(app, authenticate);

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db_connected: db.isConnected(),
    });
  });

  return app;
}

function startServer(port = PORT) {
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

  return { app, server };
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = {
  createApp,
  startServer,
};
