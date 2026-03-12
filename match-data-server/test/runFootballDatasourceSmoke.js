const assert = require('node:assert/strict');

const SEEDED_LIVE_MATCH_ID = '22000000-0000-0000-0000-000000000002';

if (!process.env.API_KEY) {
  process.env.API_KEY = 'matchflow-local-football-test-key-20260311';
}
if (!process.env.ACCESS_TOKEN_SECRET) {
  process.env.ACCESS_TOKEN_SECRET = 'matchflow-local-football-access-secret-20260311';
}
if (!process.env.REFRESH_TOKEN_SECRET) {
  process.env.REFRESH_TOKEN_SECRET = 'matchflow-local-football-refresh-secret-20260311';
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5432/matchflow';
}
if (!process.env.DB_SSL_MODE) {
  process.env.DB_SSL_MODE = 'disable';
}

const { startServer } = require('../index');

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    body = { raw: text };
  }
  return { status: response.status, body };
}

async function stopServer(server) {
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
      throw new Error('Cannot resolve server address');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const headers = {
      Authorization: `Bearer ${process.env.API_KEY}`,
      'Content-Type': 'application/json',
    };

    const ready = await requestJson(baseUrl, '/readyz', { headers });
    assert.equal(ready.status, 200);
    assert.equal(ready.body?.status, 'ready');

    const matches = await requestJson(baseUrl, '/matches?domainId=football&limit=10', {
      headers,
    });
    assert.equal(matches.status, 200);
    assert.ok(Array.isArray(matches.body?.data));
    assert.ok(matches.body.data.length >= 4);

    const liveMatch = matches.body.data.find((match) => match.id === SEEDED_LIVE_MATCH_ID);
    assert.ok(liveMatch, 'expected seeded live football match in dataset');
    assert.equal(liveMatch?.sourceContext?.domainId, 'football');
    assert.equal(liveMatch?.analysisConfig?.planning?.templateId, 'live_market_pro');

    const liveFeed = await requestJson(baseUrl, '/matches/live', { headers });
    assert.equal(liveFeed.status, 200);
    assert.ok(Array.isArray(liveFeed.body?.data));
    assert.ok(liveFeed.body.data.some((match) => match.id === liveMatch.id));

    const config = await requestJson(
      baseUrl,
      `/analysis/config/match/${encodeURIComponent(liveMatch.id)}`,
      { headers },
    );
    assert.equal(config.status, 200);
    assert.equal(config.body?.data?.matchId, liveMatch.id);
    assert.equal(config.body?.data?.sourceContext?.planning?.templateId, 'live_market_pro');
    assert.ok(
      Array.isArray(config.body?.data?.sourceContext?.selectedSourceIds) &&
        config.body.data.sourceContext.selectedSourceIds.includes('market'),
    );

    console.log('PASS football datasource smoke');
  } finally {
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error('football datasource smoke failed');
  console.error(error);
  process.exit(1);
});
