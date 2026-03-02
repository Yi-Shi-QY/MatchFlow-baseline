const assert = require('node:assert/strict');

if (!process.env.API_KEY) {
  process.env.API_KEY = 'your-secret-key';
}
if (!process.env.ACCESS_TOKEN_SECRET) {
  process.env.ACCESS_TOKEN_SECRET = `${process.env.API_KEY}-access`;
}
if (!process.env.REFRESH_TOKEN_SECRET) {
  process.env.REFRESH_TOKEN_SECRET = `${process.env.API_KEY}-refresh`;
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/matchflow';
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

async function startServerContext() {
  const started = startServer(0);
  const { server } = started;
  if (!server.listening) {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.once('listening', resolve);
    });
  }
  const address = server.address();
  if (!address || typeof address !== 'object') {
    throw new Error('Cannot resolve server address for joint smoke');
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function runValidationAndWait(baseUrl, headers, body) {
  const started = await requestJson(baseUrl, '/admin/validate/run', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  assert.equal(started.status, 202);
  const runId = started.body?.data?.id;
  assert.ok(typeof runId === 'string' && runId.length > 0);

  if (started.body?.data?.status === 'succeeded') {
    return started.body.data;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const fetched = await requestJson(baseUrl, `/admin/validate/${encodeURIComponent(runId)}`, {
      method: 'GET',
      headers,
    });
    assert.equal(fetched.status, 200);
    if (fetched.body?.data?.status === 'succeeded') {
      return fetched.body.data;
    }
    if (fetched.body?.data?.status === 'failed') {
      throw new Error(`validation run ${runId} failed`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`validation run ${runId} timeout`);
}

function buildDatasourceManifest(itemId, v11 = false) {
  return {
    id: itemId,
    name: v11 ? 'Joint Smoke Datasource v1.1' : 'Joint Smoke Datasource v1.0',
    requiredPermissions: ['datasource:use:market'],
    fields: v11
      ? [
          { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
          { id: 'had_away', type: 'number', path: ['odds', 'had', 'a'] },
          { id: 'had_draw', type: 'number', path: ['odds', 'had', 'd'] },
        ]
      : [
          { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
          { id: 'had_away', type: 'number', path: ['odds', 'had', 'a'] },
        ],
    formSections: [
      {
        id: 'market_odds',
        titleKey: 'match.market_odds',
        columns: 2,
        fields: v11 ? ['had_home', 'had_away', 'had_draw'] : ['had_home', 'had_away'],
      },
    ],
  };
}

async function main() {
  const runTag = `${Date.now()}`;
  const itemId = `joint_ds_${runTag}`;
  const apiKey = process.env.API_KEY;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  let serverContext = null;
  try {
    serverContext = await startServerContext();
    const { baseUrl } = serverContext;

    const createEntry = await requestJson(baseUrl, '/admin/catalog/datasource', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        itemId,
        version: '1.0.0',
        status: 'draft',
        channel: 'internal',
        manifest: buildDatasourceManifest(itemId, false),
      }),
    });
    assert.equal(createEntry.status, 201);

    const listEntries = await requestJson(baseUrl, '/admin/catalog/datasource?search=joint_ds_&limit=50', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    assert.equal(listEntries.status, 200);
    const entries = Array.isArray(listEntries.body?.data) ? listEntries.body.data : [];
    assert.ok(entries.some((entry) => entry.itemId === itemId));

    const listRevisions = await requestJson(
      baseUrl,
      `/admin/catalog/datasource/${encodeURIComponent(itemId)}/revisions?limit=20`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    assert.equal(listRevisions.status, 200);
    const revisions = Array.isArray(listRevisions.body?.data) ? listRevisions.body.data : [];
    assert.ok(revisions.some((revision) => revision.version === '1.0.0'));

    const saveDraft = await requestJson(
      baseUrl,
      `/admin/catalog/datasource/${encodeURIComponent(itemId)}/revisions/1.0.0`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          channel: 'internal',
          manifest: {
            ...buildDatasourceManifest(itemId, false),
            name: 'Joint Smoke Datasource v1.0 draft-saved',
          },
        }),
      },
    );
    assert.equal(saveDraft.status, 200);

    const createRevision = await requestJson(
      baseUrl,
      `/admin/catalog/datasource/${encodeURIComponent(itemId)}/revisions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          version: '1.1.0',
          status: 'draft',
          channel: 'internal',
          manifest: buildDatasourceManifest(itemId, true),
        }),
      },
    );
    assert.equal(createRevision.status, 201);

    const diff = await requestJson(
      baseUrl,
      `/admin/catalog/datasource/${encodeURIComponent(itemId)}/diff?fromVersion=1.0.0&toVersion=1.1.0`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    assert.equal(diff.status, 200);
    assert.ok((diff.body?.data?.diff?.summary?.totalChanges || 0) > 0);

    const validateV10 = await runValidationAndWait(baseUrl, headers, {
      runType: 'catalog_validate',
      domain: 'datasource',
      scope: { itemId, version: '1.0.0' },
    });
    const validateV11 = await runValidationAndWait(baseUrl, headers, {
      runType: 'catalog_validate',
      domain: 'datasource',
      scope: { itemId, version: '1.1.0' },
    });
    assert.equal(validateV10.status, 'succeeded');
    assert.equal(validateV11.status, 'succeeded');

    const publishV10 = await requestJson(
      baseUrl,
      `/admin/catalog/datasource/${encodeURIComponent(itemId)}/publish`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          version: '1.0.0',
          channel: 'stable',
          validationRunId: validateV10.id,
          notes: 'joint smoke publish v1.0.0',
        }),
      },
    );
    assert.equal(publishV10.status, 200);

    const publishV11 = await requestJson(
      baseUrl,
      `/admin/catalog/datasource/${encodeURIComponent(itemId)}/publish`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          version: '1.1.0',
          channel: 'stable',
          validationRunId: validateV11.id,
          notes: 'joint smoke publish v1.1.0',
        }),
      },
    );
    assert.equal(publishV11.status, 200);

    const rollback = await requestJson(
      baseUrl,
      `/admin/catalog/datasource/${encodeURIComponent(itemId)}/rollback`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetVersion: '1.0.0',
          channel: 'stable',
          notes: 'joint smoke rollback',
        }),
      },
    );
    assert.equal(rollback.status, 200);

    const releaseHistory = await requestJson(
      baseUrl,
      '/admin/release/history?domain=datasource&limit=40',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    assert.equal(releaseHistory.status, 200);
    const records = Array.isArray(releaseHistory.body?.data) ? releaseHistory.body.data : [];
    const related = records.filter((record) => record.itemId === itemId);
    assert.ok(related.some((record) => record.action === 'publish'));
    assert.ok(related.some((record) => record.action === 'rollback'));

    console.log(`PASS joint-smoke workflow for datasource item ${itemId}`);
  } finally {
    await stopServer(serverContext?.server);
  }
}

main().catch((error) => {
  console.error('joint-smoke runner failed');
  console.error(error);
  process.exit(1);
});
