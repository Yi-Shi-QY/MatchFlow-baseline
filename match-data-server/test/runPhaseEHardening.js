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

const HEALTH_P95_LIMIT_MS = Number.parseInt(process.env.PHASE_E_HEALTH_P95_MAX_MS || '300', 10);
const CATALOG_P95_LIMIT_MS = Number.parseInt(process.env.PHASE_E_CATALOG_P95_MAX_MS || '600', 10);

function nowMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

async function requestJson(baseUrl, path, options = {}) {
  const startedAt = nowMs();
  const response = await fetch(`${baseUrl}${path}`, options);
  const durationMs = nowMs() - startedAt;
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    body = { raw: text };
  }
  return { status: response.status, body, durationMs };
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
    throw new Error('Cannot resolve server address for phase-e hardening');
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.min(index, sorted.length - 1)];
}

async function runCase(name, fn, counters) {
  try {
    await fn();
    counters.passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    counters.failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

function buildDatasourceManifest(itemId, versionTag) {
  return {
    id: itemId,
    name: `Phase-E Datasource ${versionTag}`,
    labelKey: `datasource.${itemId}.label`,
    requiredPermissions: ['datasource:use:market'],
    cardSpan: 1,
    defaultSelected: true,
    fields: [
      { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
      { id: 'had_away', type: 'number', path: ['odds', 'had', 'a'] },
    ],
    formSections: [
      {
        id: 'market_odds',
        titleKey: 'match.market_odds',
        columns: 2,
        fields: ['had_home', 'had_away'],
      },
    ],
    applyRules: [
      { target: 'sourceContext.selectedSources.market' },
    ],
    removeRules: [
      { target: 'odds' },
    ],
  };
}

function buildPlanningManifest(itemId) {
  return {
    id: itemId,
    name: 'Phase-E Planning Template',
    rule: 'Use concise two-segment planning for market-focused matches.',
    requiredAgents: ['overview', 'momentum_agent'],
    requiredSkills: ['select_plan_template_v2'],
    segments: [
      {
        id: 'segment_1',
        agentType: 'overview',
        title: { en: 'Overview', zh: '概览' },
        focus: { en: 'Summarize match baseline.', zh: '总结比赛基线。' },
        contextMode: 'independent',
      },
      {
        id: 'segment_2',
        agentType: 'momentum_agent',
        title: { en: 'Momentum', zh: '动量' },
        focus: { en: 'Explain momentum changes.', zh: '解释动量变化。' },
        contextMode: 'build_upon',
      },
    ],
  };
}

function buildAnimationManifest(itemId) {
  return {
    id: itemId,
    name: 'Phase-E Animation Template',
    description: 'Animation payload contract for strict validation.',
    animationType: 'stats',
    templateId: 'stats-comparison',
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
      homeValue: 1.12,
      awayValue: 0.88,
    },
  };
}

function buildAgentManifest(itemId) {
  return {
    kind: 'agent',
    id: itemId,
    name: 'Phase-E Agent',
    description: 'Agent contract for strict validator hardening.',
    rolePrompt: {
      en: 'You are a concise football analyst.',
      zh: '你是一个简洁的足球分析师。',
    },
    skills: ['select_plan_template_v2'],
    contextDependencies: 'all',
  };
}

function buildSkillManifest(itemId) {
  return {
    kind: 'skill',
    id: itemId,
    name: 'Phase-E Skill',
    description: 'Skill alias contract for strict validator hardening.',
    declaration: {
      name: itemId,
      description: 'Delegates to built-in template selector.',
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

async function runValidationAndWait(baseUrl, apiHeaders, input) {
  const started = await requestJson(baseUrl, '/admin/validate/run', {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify(input),
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
      headers: apiHeaders,
    });
    assert.equal(fetched.status, 200);
    const status = fetched.body?.data?.status;
    if (status === 'succeeded') {
      return fetched.body.data;
    }
    if (status === 'failed') {
      throw new Error(`validation run ${runId} failed`);
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  throw new Error(`validation run ${runId} did not finish in expected time`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for phase-e hardening checks');
  }

  const counters = { passed: 0, failed: 0 };
  const runTag = `${Date.now()}`;
  const apiKey = process.env.API_KEY;
  const apiHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const created = {
    validationRuns: {},
  };

  let serverContext = null;

  try {
    serverContext = await startServerContext();

    await runCase('phase-e e2e: create+validate across all catalog domains', async () => {
      const records = [
        {
          domain: 'datasource',
          itemId: `phasee_ds_${runTag}`,
          manifest: buildDatasourceManifest(`phasee_ds_${runTag}`, 'v1'),
        },
        {
          domain: 'planning_template',
          itemId: `phasee_tpl_${runTag}`,
          manifest: buildPlanningManifest(`phasee_tpl_${runTag}`),
        },
        {
          domain: 'animation_template',
          itemId: `phasee_anim_${runTag}`,
          manifest: buildAnimationManifest(`phasee_anim_${runTag}`),
        },
        {
          domain: 'agent',
          itemId: `phasee_agent_${runTag}`,
          manifest: buildAgentManifest(`phasee_agent_${runTag}`),
        },
        {
          domain: 'skill',
          itemId: `phasee_skill_${runTag}`,
          manifest: buildSkillManifest(`phasee_skill_${runTag}`),
        },
      ];

      for (const record of records) {
        const createResponse = await requestJson(
          serverContext.baseUrl,
          `/admin/catalog/${record.domain}`,
          {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({
              itemId: record.itemId,
              version: '1.0.0',
              status: 'draft',
              channel: 'internal',
              manifest: record.manifest,
            }),
          },
        );
        assert.equal(createResponse.status, 201);

        const validation = await runValidationAndWait(serverContext.baseUrl, apiHeaders, {
          runType: 'catalog_validate',
          domain: record.domain,
          scope: {
            itemId: record.itemId,
            version: '1.0.0',
          },
        });
        assert.equal(validation.status, 'succeeded');
        const checks = Array.isArray(validation?.result?.checks) ? validation.result.checks : [];
        assert.ok(checks.some((check) => check.name === 'schema'));
        assert.ok(checks.some((check) => check.name === 'dependency'));
        assert.ok(checks.some((check) => check.name === 'compatibility'));

        created[record.domain] = record.itemId;
        created.validationRuns[`${record.domain}@1.0.0`] = validation.id;
      }
    }, counters);

    await runCase('phase-e e2e: datasource publish + rollback workflow remains healthy', async () => {
      const itemId = created.datasource;
      assert.ok(itemId);

      const publishV1 = await requestJson(
        serverContext.baseUrl,
        `/admin/catalog/datasource/${itemId}/publish`,
        {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            version: '1.0.0',
            channel: 'stable',
            validationRunId: created.validationRuns['datasource@1.0.0'],
            notes: 'phase-e publish v1',
          }),
        },
      );
      assert.equal(publishV1.status, 200);

      const createV11 = await requestJson(
        serverContext.baseUrl,
        `/admin/catalog/datasource/${itemId}/revisions`,
        {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            version: '1.1.0',
            status: 'draft',
            channel: 'internal',
            manifest: {
              ...buildDatasourceManifest(itemId, 'v1.1'),
              fields: [
                { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
                { id: 'had_away', type: 'number', path: ['odds', 'had', 'a'] },
                { id: 'had_draw', type: 'number', path: ['odds', 'had', 'd'] },
              ],
              formSections: [
                {
                  id: 'market_odds',
                  titleKey: 'match.market_odds',
                  columns: 2,
                  fields: ['had_home', 'had_away', 'had_draw'],
                },
              ],
            },
          }),
        },
      );
      assert.equal(createV11.status, 201);

      const validateV11 = await runValidationAndWait(serverContext.baseUrl, apiHeaders, {
        runType: 'catalog_validate',
        domain: 'datasource',
        scope: { itemId, version: '1.1.0' },
      });

      const publishV11 = await requestJson(
        serverContext.baseUrl,
        `/admin/catalog/datasource/${itemId}/publish`,
        {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            version: '1.1.0',
            channel: 'stable',
            validationRunId: validateV11.id,
            notes: 'phase-e publish v1.1',
          }),
        },
      );
      assert.equal(publishV11.status, 200);

      const rollback = await requestJson(
        serverContext.baseUrl,
        `/admin/catalog/datasource/${itemId}/rollback`,
        {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            targetVersion: '1.0.0',
            channel: 'stable',
            notes: 'phase-e rollback to v1',
          }),
        },
      );
      assert.equal(rollback.status, 200);
    }, counters);

    await runCase('phase-e perf: health and catalog list latency stay within smoke thresholds', async () => {
      const healthLatencies = [];
      for (let i = 0; i < 25; i += 1) {
        const response = await requestJson(serverContext.baseUrl, '/health', { method: 'GET' });
        assert.equal(response.status, 200);
        healthLatencies.push(response.durationMs);
      }
      const healthP95 = percentile(healthLatencies, 95);
      assert.ok(
        healthP95 <= HEALTH_P95_LIMIT_MS,
        `health p95 ${healthP95.toFixed(2)}ms exceeds ${HEALTH_P95_LIMIT_MS}ms`,
      );

      const catalogLatencies = [];
      for (let i = 0; i < 20; i += 1) {
        const response = await requestJson(
          serverContext.baseUrl,
          '/admin/catalog/datasource?limit=20',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
        );
        assert.equal(response.status, 200);
        catalogLatencies.push(response.durationMs);
      }
      const catalogP95 = percentile(catalogLatencies, 95);
      assert.ok(
        catalogP95 <= CATALOG_P95_LIMIT_MS,
        `catalog list p95 ${catalogP95.toFixed(2)}ms exceeds ${CATALOG_P95_LIMIT_MS}ms`,
      );

      console.log(
        `phase-e perf metrics: health p95=${healthP95.toFixed(2)}ms, catalog p95=${catalogP95.toFixed(2)}ms`,
      );
    }, counters);

    await runCase('phase-e recovery: invalid request does not poison subsequent valid workflow', async () => {
      const invalidCreate = await requestJson(serverContext.baseUrl, '/admin/catalog/skill', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          itemId: `phasee_invalid_skill_${runTag}`,
          version: '1.0.0',
          manifest: {
            kind: 'skill',
            id: `phasee_invalid_skill_${runTag}`,
            name: 'Invalid Skill',
            description: 'Missing runtime contract',
            declaration: {
              name: `phasee_invalid_skill_${runTag}`,
              description: 'Invalid declaration',
            },
            runtime: {
              mode: 'custom',
            },
          },
        }),
      });
      assert.equal(invalidCreate.status, 400);
      assert.equal(invalidCreate.body?.error?.code, 'CATALOG_MANIFEST_SCHEMA_INVALID');

      const recoveredItemId = `phasee_recover_skill_${runTag}`;
      const validCreate = await requestJson(serverContext.baseUrl, '/admin/catalog/skill', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          itemId: recoveredItemId,
          version: '1.0.0',
          manifest: buildSkillManifest(recoveredItemId),
        }),
      });
      assert.equal(validCreate.status, 201);

      const validRun = await runValidationAndWait(serverContext.baseUrl, apiHeaders, {
        runType: 'catalog_validate',
        domain: 'skill',
        scope: {
          itemId: recoveredItemId,
          version: '1.0.0',
        },
      });
      assert.equal(validRun.status, 'succeeded');
    }, counters);

    await runCase('phase-e recovery: service restart keeps persisted catalog revisions readable', async () => {
      const restartItemId = `phasee_restart_tpl_${runTag}`;
      const createBeforeRestart = await requestJson(
        serverContext.baseUrl,
        '/admin/catalog/planning_template',
        {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            itemId: restartItemId,
            version: '1.0.0',
            status: 'draft',
            channel: 'internal',
            manifest: buildPlanningManifest(restartItemId),
          }),
        },
      );
      assert.equal(createBeforeRestart.status, 201);

      await stopServer(serverContext.server);
      serverContext = await startServerContext();

      const revisionsAfterRestart = await requestJson(
        serverContext.baseUrl,
        `/admin/catalog/planning_template/${restartItemId}/revisions?limit=5`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );
      assert.equal(revisionsAfterRestart.status, 200);
      const revisions = Array.isArray(revisionsAfterRestart.body?.data)
        ? revisionsAfterRestart.body.data
        : [];
      assert.ok(revisions.some((revision) => revision.version === '1.0.0'));
    }, counters);
  } finally {
    await stopServer(serverContext?.server);
  }

  console.log(`SUMMARY: ${counters.passed} passed, ${counters.failed} failed`);
  if (counters.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Phase-E hardening suite crashed');
  console.error(error);
  process.exit(1);
});
