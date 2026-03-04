if (!process.env.DOTENV_CONFIG_PATH) {
  process.env.DOTENV_CONFIG_PATH = '.env.production';
}

require('./preflightProd');
