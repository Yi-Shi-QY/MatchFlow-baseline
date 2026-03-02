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

function buildAdminStudioClient(baseUrl, apiKey) {
  const authHeader = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  async function request(path, options = {}) {
    const method = options.method || 'GET';
    const query = options.query || null;
    const body = options.body;

    const url = new URL(path, baseUrl);
    if (query && typeof query === 'object') {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || String(value).trim() === '') {
          return;
        }
        url.searchParams.set(key, String(value));
      });
    }

    const response = await requestJson(baseUrl, `${url.pathname}${url.search}`, {
      method,
      headers: authHeader,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status >= 400) {
      const message = response.body?.error?.message || `Request failed: ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.code = response.body?.error?.code || null;
      error.details = response.body?.error?.details || null;
      throw error;
    }

    return response.body;
  }

  return {
    listCatalogEntries(domain, params = {}) {
      return request(`/admin/catalog/${domain}`, {
        method: 'GET',
        query: params,
      });
    },
    createCatalogEntry(domain, payload) {
      return request(`/admin/catalog/${domain}`, {
        method: 'POST',
        body: payload,
      });
    },
    listCatalogRevisions(domain, itemId, params = {}) {
      return request(`/admin/catalog/${domain}/${encodeURIComponent(itemId)}/revisions`, {
        method: 'GET',
        query: params,
      });
    },
    updateCatalogDraftRevision(domain, itemId, version, payload) {
      return request(
        `/admin/catalog/${domain}/${encodeURIComponent(itemId)}/revisions/${encodeURIComponent(version)}`,
        {
          method: 'PUT',
          body: payload,
        },
      );
    },
    createCatalogRevision(domain, itemId, payload) {
      return request(`/admin/catalog/${domain}/${encodeURIComponent(itemId)}/revisions`, {
        method: 'POST',
        body: payload,
      });
    },
    getCatalogRevisionDiff(domain, itemId, fromVersion, toVersion) {
      return request(`/admin/catalog/${domain}/${encodeURIComponent(itemId)}/diff`, {
        method: 'GET',
        query: {
          fromVersion,
          toVersion,
        },
      });
    },
    runCatalogValidation(domain, itemId, version) {
      return request('/admin/validate/run', {
        method: 'POST',
        body: {
          runType: 'catalog_validate',
          domain,
          scope: {
            itemId,
            version,
          },
        },
      });
    },
    getValidationRun(runId) {
      return request(`/admin/validate/${encodeURIComponent(runId)}`, {
        method: 'GET',
      });
    },
    publishCatalogRevision(domain, itemId, payload) {
      return request(`/admin/catalog/${domain}/${encodeURIComponent(itemId)}/publish`, {
        method: 'POST',
        body: payload,
      });
    },
    rollbackCatalogRevision(domain, itemId, payload) {
      return request(`/admin/catalog/${domain}/${encodeURIComponent(itemId)}/rollback`, {
        method: 'POST',
        body: payload,
      });
    },
    listReleaseHistory(params = {}) {
      return request('/admin/release/history', {
        method: 'GET',
        query: params,
      });
    },
  };
}

function buildDatasourceManifest(itemId, includeDrawField) {
  return {
    id: itemId,
    name: includeDrawField ? 'Web Joint Datasource v1.1' : 'Web Joint Datasource v1.0',
    requiredPermissions: ['datasource:use:market'],
    fields: includeDrawField
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
        fields: includeDrawField ? ['had_home', 'had_away', 'had_draw'] : ['had_home', 'had_away'],
      },
    ],
  };
}

function buildPlanningManifest(itemId) {
  return {
    id: itemId,
    name: 'Web Joint Planning Template',
    description: 'Planning template used by web-client joint smoke',
    rule: 'Use this template for live market coverage',
    requiredAgents: ['overview'],
    requiredSkills: ['select_plan_template_v2'],
    segments: [
      {
        id: 'segment_1',
        title: { en: 'Overview', zh: 'Overview (zh)' },
        focus: { en: 'Summarize latest changes', zh: 'Summarize latest changes (zh)' },
        agentType: 'overview',
        contextMode: 'independent',
        animationType: 'scoreboard',
      },
    ],
  };
}

function buildAnimationManifest(itemId) {
  return {
    id: itemId,
    name: 'Web Joint Animation Template',
    description: 'Animation template used by web-client joint smoke',
    animationType: 'stats',
    templateId: `tpl_${itemId}`,
    requiredParams: ['metric', 'homeValue', 'awayValue'],
    schema: {
      type: 'object',
      properties: {
        metric: { type: 'string' },
        homeValue: { type: 'number' },
        awayValue: { type: 'number' },
      },
      required: ['metric', 'homeValue', 'awayValue'],
    },
    example: {
      metric: 'xg',
      homeValue: 1.24,
      awayValue: 0.92,
    },
  };
}

function buildAgentManifest(itemId) {
  return {
    kind: 'agent',
    id: itemId,
    name: 'Web Joint Agent',
    description: 'Agent manifest used by web-client joint smoke',
    rolePrompt: {
      en: 'You are a concise football analyst.',
      zh: 'You are a concise football analyst (zh).',
    },
    skills: ['select_plan_template_v2'],
    contextDependencies: 'all',
  };
}

function buildSkillManifest(itemId) {
  return {
    kind: 'skill',
    id: itemId,
    name: 'Web Joint Skill',
    description: 'Skill manifest used by web-client joint smoke',
    declaration: {
      name: itemId,
      description: 'Delegates to builtin planner selector',
      parameters: {
        type: 'object',
        properties: {
          matchId: { type: 'string' },
        },
        required: ['matchId'],
      },
    },
    runtime: {
      mode: 'builtin_alias',
      targetSkill: 'select_plan_template',
    },
  };
}

function buildManifest(domain, itemId, includeDrawField = false) {
  if (domain === 'datasource') {
    return buildDatasourceManifest(itemId, includeDrawField);
  }
  if (domain === 'planning_template') {
    return buildPlanningManifest(itemId);
  }
  if (domain === 'animation_template') {
    return buildAnimationManifest(itemId);
  }
  if (domain === 'agent') {
    return buildAgentManifest(itemId);
  }
  return buildSkillManifest(itemId);
}

async function waitForValidation(client, domain, itemId, version) {
  const started = await client.runCatalogValidation(domain, itemId, version);
  const runId = started?.data?.id;
  assert.ok(typeof runId === 'string' && runId.length > 0);

  if (started?.data?.status === 'succeeded') {
    return started.data;
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const fetched = await client.getValidationRun(runId);
    if (fetched?.data?.status === 'succeeded') {
      return fetched.data;
    }
    if (fetched?.data?.status === 'failed') {
      throw new Error(`validation failed for ${domain}:${itemId}:${version}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  throw new Error(`validation timed out for ${domain}:${itemId}:${version}`);
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
  const apiKey = process.env.API_KEY;

  try {
    if (!server.listening) {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.once('listening', resolve);
      });
    }

    const address = server.address();
    if (!address || typeof address !== 'object') {
      throw new Error('Cannot resolve server address for web-client joint smoke');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const client = buildAdminStudioClient(baseUrl, apiKey);
    const domains = [
      'datasource',
      'planning_template',
      'animation_template',
      'agent',
      'skill',
    ];
    const runTag = String(Date.now());
    const itemByDomain = new Map();

    for (const domain of domains) {
      const itemId = `web_joint_${domain}_${runTag}`;
      itemByDomain.set(domain, itemId);

      const created = await client.createCatalogEntry(domain, {
        itemId,
        version: '1.0.0',
        status: 'draft',
        channel: 'internal',
        manifest: buildManifest(domain, itemId, false),
      });
      assert.equal(created?.data?.itemId, itemId);
      assert.equal(created?.data?.version, '1.0.0');

      const entries = await client.listCatalogEntries(domain, {
        search: `web_joint_${domain}_`,
        limit: 50,
      });
      const entryRows = Array.isArray(entries?.data) ? entries.data : [];
      assert.ok(entryRows.some((entry) => entry.itemId === itemId));

      const revisions = await client.listCatalogRevisions(domain, itemId, {
        limit: 20,
      });
      const revisionRows = Array.isArray(revisions?.data) ? revisions.data : [];
      assert.ok(revisionRows.some((revision) => revision.version === '1.0.0'));

      const validated = await waitForValidation(client, domain, itemId, '1.0.0');
      assert.equal(validated.status, 'succeeded');
    }

    const datasourceId = itemByDomain.get('datasource');
    assert.ok(datasourceId);

    const draftSaved = await client.updateCatalogDraftRevision(
      'datasource',
      datasourceId,
      '1.0.0',
      {
        channel: 'internal',
        manifest: {
          ...buildDatasourceManifest(datasourceId, false),
          name: 'Web Joint Datasource v1.0 draft updated',
        },
      },
    );
    assert.equal(draftSaved?.data?.version, '1.0.0');

    const validationV10AfterDraftSave = await waitForValidation(
      client,
      'datasource',
      datasourceId,
      '1.0.0',
    );
    assert.equal(validationV10AfterDraftSave.status, 'succeeded');

    const createdV11 = await client.createCatalogRevision('datasource', datasourceId, {
      version: '1.1.0',
      status: 'draft',
      channel: 'internal',
      manifest: buildDatasourceManifest(datasourceId, true),
    });
    assert.equal(createdV11?.data?.version, '1.1.0');

    const diff = await client.getCatalogRevisionDiff('datasource', datasourceId, '1.0.0', '1.1.0');
    assert.ok((diff?.data?.diff?.summary?.totalChanges || 0) > 0);

    const validationV11 = await waitForValidation(client, 'datasource', datasourceId, '1.1.0');
    assert.equal(validationV11.status, 'succeeded');

    const publishV10 = await client.publishCatalogRevision('datasource', datasourceId, {
      version: '1.0.0',
      channel: 'stable',
      notes: 'web client joint smoke publish v1.0.0',
      validationRunId: validationV10AfterDraftSave.id,
    });
    assert.equal(publishV10?.data?.action, 'publish');
    assert.equal(publishV10?.data?.toVersion, '1.0.0');

    const publishV11 = await client.publishCatalogRevision('datasource', datasourceId, {
      version: '1.1.0',
      channel: 'stable',
      notes: 'web client joint smoke publish v1.1.0',
      validationRunId: validationV11.id,
    });
    assert.equal(publishV11?.data?.action, 'publish');
    assert.equal(publishV11?.data?.toVersion, '1.1.0');

    const rollback = await client.rollbackCatalogRevision('datasource', datasourceId, {
      targetVersion: '1.0.0',
      channel: 'stable',
      notes: 'web client joint smoke rollback',
    });
    assert.equal(rollback?.data?.action, 'rollback');
    assert.equal(rollback?.data?.toVersion, '1.0.0');

    const releaseHistory = await client.listReleaseHistory({
      domain: 'datasource',
      limit: 80,
    });
    const releaseRows = Array.isArray(releaseHistory?.data) ? releaseHistory.data : [];
    const relatedRows = releaseRows.filter((record) => record.itemId === datasourceId);
    assert.ok(relatedRows.some((record) => record.action === 'publish'));
    assert.ok(relatedRows.some((record) => record.action === 'rollback'));

    console.log(`PASS web-client joint smoke lifecycle for datasource item ${datasourceId}`);
    console.log(`PASS web-client strict-domain checks for ${domains.length} domains`);
  } finally {
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error('web-client joint smoke runner failed');
  console.error(error);
  process.exit(1);
});
