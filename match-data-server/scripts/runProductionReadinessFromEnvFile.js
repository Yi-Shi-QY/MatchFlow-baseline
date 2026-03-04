const path = process.env.DOTENV_CONFIG_PATH || '.env.production';

require('dotenv').config({ path });

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

require('../test/runProductionReadiness');
