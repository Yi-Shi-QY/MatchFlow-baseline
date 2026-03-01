require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { PORT, API_KEY } = require('./src/config');
const { createAuthenticateMiddleware } = require('./src/middlewares/authenticate');
const { registerMatchRoutes } = require('./src/routes/matchRoutes');
const { registerAnalysisConfigRoutes } = require('./src/routes/analysisConfigRoutes');
const { registerHubRoutes } = require('./src/routes/hubRoutes');
const { registerAdminRoutes } = require('./src/routes/adminRoutes');

const app = express();
const authenticate = createAuthenticateMiddleware(API_KEY);

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Match Data Server running on port ${PORT}`);
  console.log(`API Key configured: ${API_KEY.substring(0, 4)}...`);
  console.log(
    `Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Not Configured (Using Mock Data)'}`,
  );
});

