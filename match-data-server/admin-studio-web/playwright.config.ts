import { defineConfig, devices } from '@playwright/test';

const serverPort = process.env.E2E_SERVER_PORT || '3001';
const adminWebPort = process.env.E2E_ADMIN_WEB_PORT || '3030';
const matchDataServerUrl = process.env.E2E_MATCH_DATA_SERVER_URL || `http://127.0.0.1:${serverPort}`;
const adminWebUrl = process.env.E2E_ADMIN_WEB_URL || `http://127.0.0.1:${adminWebPort}`;
const apiKey = process.env.E2E_MATCH_DATA_API_KEY || process.env.API_KEY || 'your-secret-key';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: adminWebUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node ../index.js',
      url: `${matchDataServerUrl}/readyz`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: serverPort,
        NODE_ENV: process.env.NODE_ENV || 'development',
        API_KEY: apiKey,
        ACCESS_TOKEN_SECRET:
          process.env.ACCESS_TOKEN_SECRET || 'e2e_access_token_secret_012345678901',
        REFRESH_TOKEN_SECRET:
          process.env.REFRESH_TOKEN_SECRET || 'e2e_refresh_token_secret_01234567890',
        DATABASE_URL:
          process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/matchflow',
        DB_SSL_MODE: process.env.DB_SSL_MODE || 'disable',
        ENABLE_ADMIN_STUDIO: process.env.ENABLE_ADMIN_STUDIO || 'true',
        ENABLE_SERVER2_PHASE_GATES: process.env.ENABLE_SERVER2_PHASE_GATES || 'true',
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${adminWebPort}`,
      url: adminWebUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_MATCH_DATA_SERVER_URL: matchDataServerUrl,
        VITE_MATCH_DATA_API_KEY: apiKey,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
