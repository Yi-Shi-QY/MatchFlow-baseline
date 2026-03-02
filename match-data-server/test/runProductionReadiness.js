const assert = require('node:assert/strict');

if (!process.env.API_KEY) {
  process.env.API_KEY = 'your-secret-key';
}
if (!process.env.ACCESS_TOKEN_SECRET) {
  process.env.ACCESS_TOKEN_SECRET = 'prod-readiness-access-secret-1234567890';
}
if (!process.env.REFRESH_TOKEN_SECRET) {
  process.env.REFRESH_TOKEN_SECRET = 'prod-readiness-refresh-secret-1234567890';
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/matchflow';
}
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

const { startServer } = require('../index');

async function request(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    body = { raw: text };
  }
  return {
    status: response.status,
    headers: response.headers,
    body,
  };
}

async function stopServer(server) {
  if (!server) {
    return;
  }
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const started = startServer(0);
  const { server } = started;

  try {
    if (!server.listening) {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.once('listening', resolve);
      });
    }

    const address = server.address();
    if (!address || typeof address !== 'object') {
      throw new Error('Cannot resolve server address for production readiness test');
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const livez = await request(baseUrl, '/livez');
    assert.equal(livez.status, 200);
    assert.equal(livez.body?.status, 'ok');
    assert.equal(livez.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(livez.headers.get('x-frame-options'), 'DENY');
    assert.equal(livez.headers.get('referrer-policy'), 'no-referrer');

    const readyz = await request(baseUrl, '/readyz');
    assert.equal(readyz.status, 200);
    assert.equal(readyz.body?.status, 'ready');
    assert.equal(readyz.body?.checks?.database?.ok, true);

    const health = await request(baseUrl, '/health');
    assert.equal(health.status, 200);
    assert.equal(health.body?.status, 'ok');
    assert.equal(health.body?.db_connected, true);
    assert.equal(health.body?.db_ready, true);

    console.log('PASS production readiness endpoints and security headers');
  } finally {
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error('production-readiness runner failed');
  console.error(error);
  process.exit(1);
});
