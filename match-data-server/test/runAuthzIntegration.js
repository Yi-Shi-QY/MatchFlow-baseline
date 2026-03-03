const assert = require('node:assert/strict');

const API_KEY = 'legacy-test-key';
const ACCESS_TOKEN_SECRET = 'test-access-secret';
const REFRESH_TOKEN_SECRET = 'test-refresh-secret';

process.env.API_KEY = API_KEY;
process.env.ACCESS_TOKEN_SECRET = ACCESS_TOKEN_SECRET;
process.env.REFRESH_TOKEN_SECRET = REFRESH_TOKEN_SECRET;
process.env.ACCESS_TOKEN_TTL_SECONDS = '3600';
process.env.REFRESH_TOKEN_TTL_SECONDS = '7200';
process.env.DATABASE_URL = '';

const { issueAccessToken } = require('../src/services/tokenService');
const { startServer } = require('../index');

function createAccessToken(permissions, roles = ['analyst']) {
  return issueAccessToken({
    sessionId: `session-${Math.random().toString(16).slice(2)}`,
    userId: `user-${Math.random().toString(16).slice(2)}`,
    tenantId: 'tenant-default',
    roles,
    permissions,
  });
}

async function requestJson(baseUrl, pathname, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${baseUrl}${pathname}`, { headers });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    body = { raw: text };
  }
  return { status: response.status, body };
}

async function requestJsonWithBody(baseUrl, pathname, token, method, payload) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: JSON.stringify(payload || {}),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    body = { raw: text };
  }
  return { status: response.status, body };
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

async function main() {
  const counters = { passed: 0, failed: 0 };
  const started = startServer(0);
  const server = started.server;

  try {
    if (!server.listening) {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.once('listening', resolve);
      });
    }

    const address = server.address();
    if (!address || typeof address !== 'object') {
      throw new Error('Failed to resolve test server address');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    await runCase(
      'legacy API key can still read matches',
      async () => {
        const { status, body } = await requestJson(baseUrl, '/matches', API_KEY);
        assert.equal(status, 200);
        assert.ok(Array.isArray(body?.data));
        assert.ok(body.data.length > 0);
        assert.ok(body.data.some((match) => Object.prototype.hasOwnProperty.call(match, 'odds')));
      },
      counters,
    );

    await runCase(
      'token with datasource:use:fundamental can read matches but market data is filtered',
      async () => {
        const token = createAccessToken(['datasource:use:fundamental']);
        const { status, body } = await requestJson(baseUrl, '/matches', token);
        assert.equal(status, 200);
        assert.ok(Array.isArray(body?.data));
        assert.ok(body.data.length > 0);
        for (const match of body.data) {
          assert.equal(Object.prototype.hasOwnProperty.call(match, 'odds'), false);
        }
      },
      counters,
    );

    await runCase(
      'token without datasource:use:fundamental is rejected from match endpoints',
      async () => {
        const token = createAccessToken(['datasource:use:market']);
        const { status, body } = await requestJson(baseUrl, '/matches', token);
        assert.equal(status, 403);
        assert.equal(body?.error?.code, 'AUTH_FORBIDDEN');
      },
      counters,
    );

    await runCase(
      'analysis/config resolves sourceContext according to datasource permissions',
      async () => {
        const token = createAccessToken(['datasource:use:fundamental']);
        const response = await fetch(`${baseUrl}/analysis/config/resolve`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: 'test-match',
            status: 'live',
            stats: { possession: { home: 55, away: 45 } },
            odds: { had: { h: 1.9, d: 3.2, a: 4.1 } },
            sourceContext: {
              selectedSources: {
                fundamental: true,
                market: true,
                custom: false,
              },
            },
          }),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body?.data?.sourceContext?.selectedSources?.fundamental, true);
        assert.equal(body?.data?.sourceContext?.selectedSources?.market, false);
        assert.ok(
          !Array.isArray(body?.data?.sourceContext?.selectedSourceIds) ||
            !body.data.sourceContext.selectedSourceIds.includes('market'),
        );
      },
      counters,
    );

    await runCase(
      'template permission gates hub template access',
      async () => {
        const allowedToken = createAccessToken(['template:use:live_market_pro']);
        const deniedToken = createAccessToken(['template:use:basic']);

        const allowed = await requestJson(baseUrl, '/hub/templates/live_market_pro', allowedToken);
        assert.equal(allowed.status, 200);
        assert.equal(allowed.body?.data?.id, 'live_market_pro');

        const denied = await requestJson(baseUrl, '/hub/templates/live_market_pro', deniedToken);
        assert.equal(denied.status, 403);
        assert.equal(denied.body?.error?.code, 'AUTH_FORBIDDEN');
      },
      counters,
    );

    await runCase(
      'agent and skill hub access requires at least one template permission',
      async () => {
        const templateScopedToken = createAccessToken(['template:use:live_market_pro']);
        const datasourceOnlyToken = createAccessToken(['datasource:use:fundamental']);

        const templateScopedAccess = await requestJson(
          baseUrl,
          '/hub/agents/momentum_agent',
          templateScopedToken,
        );
        assert.equal(templateScopedAccess.status, 200);

        const datasourceOnlyAccess = await requestJson(
          baseUrl,
          '/hub/agents/momentum_agent',
          datasourceOnlyToken,
        );
        assert.equal(datasourceOnlyAccess.status, 403);
      },
      counters,
    );

    await runCase(
      'admin routes require admin:* permission for user tokens',
      async () => {
        const nonAdminToken = createAccessToken(['datasource:use:fundamental']);
        const adminToken = createAccessToken(['admin:*'], ['tenant_admin']);

        const denied = await requestJson(baseUrl, '/admin/extensions', nonAdminToken);
        assert.equal(denied.status, 403);
        assert.equal(denied.body?.error?.code, 'AUTH_FORBIDDEN');

        const allowed = await requestJson(baseUrl, '/admin/extensions', adminToken);
        assert.equal(allowed.status, 200);
        assert.ok(Array.isArray(allowed.body?.data));
      },
      counters,
    );

    await runCase(
      'admin identity routes enforce permission first, then DB connectivity',
      async () => {
        const nonAdminToken = createAccessToken(['datasource:use:fundamental']);
        const adminToken = createAccessToken(['admin:*'], ['tenant_admin']);

        const denied = await requestJson(baseUrl, '/admin/users', nonAdminToken);
        assert.equal(denied.status, 403);
        assert.equal(denied.body?.error?.code, 'AUTH_FORBIDDEN');

        const dbRequired = await requestJson(baseUrl, '/admin/users', adminToken);
        assert.equal(dbRequired.status, 503);
        assert.equal(dbRequired.body?.error?.code, 'ADMIN_DB_REQUIRED');
      },
      counters,
    );

    await runCase(
      'catalog routes enforce permission first, then DB connectivity',
      async () => {
        const noCatalogPermissionToken = createAccessToken(['datasource:use:fundamental']);
        const catalogEditorToken = createAccessToken(['catalog:datasource:edit'], ['tenant_admin']);

        const denied = await requestJson(baseUrl, '/admin/catalog/datasource', noCatalogPermissionToken);
        assert.equal(denied.status, 403);
        assert.equal(denied.body?.error?.code, 'AUTH_FORBIDDEN');

        const dbRequired = await requestJson(baseUrl, '/admin/catalog/datasource', catalogEditorToken);
        assert.equal(dbRequired.status, 503);
        assert.equal(dbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');
      },
      counters,
    );

    await runCase(
      'datasource preview routes enforce permission and return stable validation/db errors',
      async () => {
        const noCatalogPermissionToken = createAccessToken(['datasource:use:fundamental']);
        const catalogEditorToken = createAccessToken(['catalog:datasource:edit'], ['tenant_admin']);
        const payload = {
          manifest: {
            id: 'market_source',
            name: 'Market Source',
            fields: [{ id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] }],
          },
        };

        const deniedStructure = await requestJsonWithBody(
          baseUrl,
          '/admin/catalog/datasource/preview/structure',
          noCatalogPermissionToken,
          'POST',
          payload,
        );
        assert.equal(deniedStructure.status, 403);
        assert.equal(deniedStructure.body?.error?.code, 'AUTH_FORBIDDEN');

        const deniedData = await requestJsonWithBody(
          baseUrl,
          '/admin/catalog/datasource/preview/data',
          noCatalogPermissionToken,
          'POST',
          payload,
        );
        assert.equal(deniedData.status, 403);
        assert.equal(deniedData.body?.error?.code, 'AUTH_FORBIDDEN');

        const structure = await requestJsonWithBody(
          baseUrl,
          '/admin/catalog/datasource/preview/structure',
          catalogEditorToken,
          'POST',
          payload,
        );
        assert.equal(structure.status, 200);
        assert.equal(structure.body?.data?.sourceId, 'market_source');
        assert.ok(Array.isArray(structure.body?.data?.fieldCatalog));

        const invalidManifest = await requestJsonWithBody(
          baseUrl,
          '/admin/catalog/datasource/preview/data',
          catalogEditorToken,
          'POST',
          { manifest: 'invalid' },
        );
        assert.equal(invalidManifest.status, 400);
        assert.equal(invalidManifest.body?.error?.code, 'CATALOG_MANIFEST_INVALID');

        const dbRequired = await requestJsonWithBody(
          baseUrl,
          '/admin/catalog/datasource/preview/data',
          catalogEditorToken,
          'POST',
          payload,
        );
        assert.equal(dbRequired.status, 503);
        assert.equal(dbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');
      },
      counters,
    );

    await runCase(
      'datasource collection routes enforce permission and DB-required behavior',
      async () => {
        const noCatalogPermissionToken = createAccessToken(['datasource:use:fundamental']);
        const catalogEditorToken = createAccessToken(['catalog:datasource:edit'], ['tenant_admin']);
        const releasePublisherToken = createAccessToken(['release:publish'], ['tenant_admin']);

        const deniedCollectors = await requestJson(
          baseUrl,
          '/admin/data-collections/collectors',
          noCatalogPermissionToken,
        );
        assert.equal(deniedCollectors.status, 403);
        assert.equal(deniedCollectors.body?.error?.code, 'AUTH_FORBIDDEN');

        const listCollectorsDbRequired = await requestJson(
          baseUrl,
          '/admin/data-collections/collectors',
          catalogEditorToken,
        );
        assert.equal(listCollectorsDbRequired.status, 503);
        assert.equal(listCollectorsDbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');

        const createCollectorDbRequired = await requestJsonWithBody(
          baseUrl,
          '/admin/data-collections/collectors',
          catalogEditorToken,
          'POST',
          {
            sourceId: 'market_source',
            name: 'Market Snapshot Collector',
            provider: 'match_snapshot',
            config: { sampleLimit: 5 },
          },
        );
        assert.equal(createCollectorDbRequired.status, 503);
        assert.equal(createCollectorDbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');

        const deniedHealth = await requestJson(
          baseUrl,
          '/admin/data-collections/health',
          noCatalogPermissionToken,
        );
        assert.equal(deniedHealth.status, 403);
        assert.equal(deniedHealth.body?.error?.code, 'AUTH_FORBIDDEN');

        const healthDbRequired = await requestJson(
          baseUrl,
          '/admin/data-collections/health',
          catalogEditorToken,
        );
        assert.equal(healthDbRequired.status, 503);
        assert.equal(healthDbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');

        const deniedImport = await requestJsonWithBody(
          baseUrl,
          '/admin/data-collections/collectors/00000000-0000-4000-8000-000000000001/import',
          noCatalogPermissionToken,
          'POST',
          {
            payload: {
              rows: [{ id: 'm1' }],
            },
          },
        );
        assert.equal(deniedImport.status, 403);
        assert.equal(deniedImport.body?.error?.code, 'AUTH_FORBIDDEN');

        const importDbRequired = await requestJsonWithBody(
          baseUrl,
          '/admin/data-collections/collectors/00000000-0000-4000-8000-000000000001/import',
          catalogEditorToken,
          'POST',
          {
            payload: {
              rows: [{ id: 'm1' }],
            },
          },
        );
        assert.equal(importDbRequired.status, 503);
        assert.equal(importDbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');

        const deniedReplay = await requestJsonWithBody(
          baseUrl,
          '/admin/data-collections/snapshots/demo/replay',
          noCatalogPermissionToken,
          'POST',
          {},
        );
        assert.equal(deniedReplay.status, 403);
        assert.equal(deniedReplay.body?.error?.code, 'AUTH_FORBIDDEN');

        const replayDbRequired = await requestJsonWithBody(
          baseUrl,
          '/admin/data-collections/snapshots/00000000-0000-4000-8000-000000000001/replay',
          catalogEditorToken,
          'POST',
          {},
        );
        assert.equal(replayDbRequired.status, 503);
        assert.equal(replayDbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');

        const deniedRelease = await requestJsonWithBody(
          baseUrl,
          '/admin/data-collections/snapshots/demo/release',
          catalogEditorToken,
          'POST',
          {
            channel: 'stable',
          },
        );
        assert.equal(deniedRelease.status, 403);
        assert.equal(deniedRelease.body?.error?.code, 'AUTH_FORBIDDEN');

        const releaseDbRequired = await requestJsonWithBody(
          baseUrl,
          '/admin/data-collections/snapshots/00000000-0000-4000-8000-000000000001/release',
          releasePublisherToken,
          'POST',
          {
            channel: 'stable',
          },
        );
        assert.equal(releaseDbRequired.status, 503);
        assert.equal(releaseDbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');
      },
      counters,
    );

    await runCase(
      'catalog diff and draft-save routes enforce permission first and stable validation behavior',
      async () => {
        const noCatalogPermissionToken = createAccessToken(['datasource:use:fundamental']);
        const catalogEditorToken = createAccessToken(['catalog:datasource:edit'], ['tenant_admin']);
        const diffPath = '/admin/catalog/datasource/market_source/diff?fromVersion=1.0.0&toVersion=1.1.0';

        const diffDenied = await requestJson(baseUrl, diffPath, noCatalogPermissionToken);
        assert.equal(diffDenied.status, 403);
        assert.equal(diffDenied.body?.error?.code, 'AUTH_FORBIDDEN');

        const diffInvalid = await requestJson(
          baseUrl,
          '/admin/catalog/datasource/market_source/diff?toVersion=1.1.0',
          catalogEditorToken,
        );
        assert.equal(diffInvalid.status, 400);
        assert.equal(diffInvalid.body?.error?.code, 'CATALOG_VERSION_REQUIRED');

        const diffDbRequired = await requestJson(baseUrl, diffPath, catalogEditorToken);
        assert.equal(diffDbRequired.status, 503);
        assert.equal(diffDbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');

        const draftDenied = await requestJsonWithBody(
          baseUrl,
          '/admin/catalog/datasource/market_source/revisions/1.1.0',
          noCatalogPermissionToken,
          'PUT',
          {
            manifest: {
              id: 'market_source',
              name: 'Market Source',
              fields: [{ id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] }],
              formSections: [
                {
                  id: 'market_odds',
                  titleKey: 'match.market_odds',
                  fields: [{ id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] }],
                },
              ],
            },
          },
        );
        assert.equal(draftDenied.status, 403);
        assert.equal(draftDenied.body?.error?.code, 'AUTH_FORBIDDEN');

        const draftDbRequired = await requestJsonWithBody(
          baseUrl,
          '/admin/catalog/datasource/market_source/revisions/1.1.0',
          catalogEditorToken,
          'PUT',
          {
            manifest: {
              id: 'market_source',
              name: 'Market Source',
              fields: [{ id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] }],
              formSections: [
                {
                  id: 'market_odds',
                  titleKey: 'match.market_odds',
                  fields: [{ id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] }],
                },
              ],
            },
          },
        );
        assert.equal(draftDbRequired.status, 503);
        assert.equal(draftDbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');
      },
      counters,
    );

    await runCase(
      'catalog create validates datasource manifest before DB call',
      async () => {
        const catalogEditorToken = createAccessToken(['catalog:datasource:edit'], ['tenant_admin']);
        const invalidPayload = {
          itemId: 'market_source',
          version: '1.0.0',
          manifest: {
            id: 'market',
            name: 'Market Source',
            // invalid: field without path/homePath/drawPath/awayPath
            fields: [{ id: 'had', type: 'odds_triplet' }],
          },
        };

        const invalid = await requestJsonWithBody(
          baseUrl,
          '/admin/catalog/datasource',
          catalogEditorToken,
          'POST',
          invalidPayload,
        );
        assert.equal(invalid.status, 400);
        assert.equal(invalid.body?.error?.code, 'CATALOG_MANIFEST_SCHEMA_INVALID');
        assert.ok(Array.isArray(invalid.body?.error?.details?.checks));
      },
      counters,
    );

    await runCase(
      'catalog create validates animation_template/agent/skill manifests before DB call',
      async () => {
        const cases = [
          {
            domain: 'animation_template',
            permission: 'catalog:animation:edit',
            payload: {
              itemId: 'animation_invalid',
              version: '1.0.0',
              manifest: {
                id: 'animation_invalid',
                name: 'Invalid Animation',
                animationType: 'stats',
                // invalid: templateId/schema required
              },
            },
          },
          {
            domain: 'agent',
            permission: 'catalog:agent:edit',
            payload: {
              itemId: 'agent_invalid',
              version: '1.0.0',
              manifest: {
                kind: 'agent',
                id: 'agent_invalid',
                name: 'Invalid Agent',
                description: 'Missing role prompt zh',
                rolePrompt: {
                  en: 'You are an analyst.',
                },
              },
            },
          },
          {
            domain: 'skill',
            permission: 'catalog:skill:edit',
            payload: {
              itemId: 'skill_invalid',
              version: '1.0.0',
              manifest: {
                kind: 'skill',
                id: 'skill_invalid',
                name: 'Invalid Skill',
                description: 'Missing declaration/runtime contracts',
                declaration: {
                  name: 'skill_invalid',
                  description: 'Invalid declaration',
                },
                runtime: {
                  mode: 'custom',
                },
              },
            },
          },
        ];

        for (const testCase of cases) {
          const token = createAccessToken([testCase.permission], ['tenant_admin']);
          const response = await requestJsonWithBody(
            baseUrl,
            `/admin/catalog/${testCase.domain}`,
            token,
            'POST',
            testCase.payload,
          );
          assert.equal(response.status, 400);
          assert.equal(response.body?.error?.code, 'CATALOG_MANIFEST_SCHEMA_INVALID');
          assert.ok(Array.isArray(response.body?.error?.details?.checks));
        }
      },
      counters,
    );

    await runCase(
      'validate routes return 400 for invalid scope before DB call',
      async () => {
        const validateRunnerToken = createAccessToken(['validate:run'], ['tenant_admin']);
        const invalid = await requestJsonWithBody(
          baseUrl,
          '/admin/validate/run',
          validateRunnerToken,
          'POST',
          {
            runType: 'catalog_validate',
            domain: 'datasource',
            scope: {},
          },
        );

        assert.equal(invalid.status, 400);
        assert.equal(invalid.body?.error?.code, 'VALIDATION_SCOPE_INVALID');
      },
      counters,
    );

    await runCase(
      'validate routes enforce validate:run permission and return stable DB-required error',
      async () => {
        const noValidatePermissionToken = createAccessToken(['catalog:datasource:edit']);
        const validateRunnerToken = createAccessToken(['validate:run'], ['tenant_admin']);

        const payload = {
          runType: 'catalog_validate',
          domain: 'datasource',
          scope: {
            itemId: 'market_source',
          },
        };

        const denied = await requestJsonWithBody(
          baseUrl,
          '/admin/validate/run',
          noValidatePermissionToken,
          'POST',
          payload,
        );
        assert.equal(denied.status, 403);
        assert.equal(denied.body?.error?.code, 'AUTH_FORBIDDEN');

        const dbRequired = await requestJsonWithBody(
          baseUrl,
          '/admin/validate/run',
          validateRunnerToken,
          'POST',
          payload,
        );
        assert.equal(dbRequired.status, 503);
        assert.equal(dbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');
      },
      counters,
    );

    await runCase(
      'release history route enforces release:read permission and DB-required behavior',
      async () => {
        const noReleaseReadToken = createAccessToken(['catalog:datasource:edit']);
        const releaseReadToken = createAccessToken(['release:read'], ['tenant_admin']);

        const denied = await requestJson(baseUrl, '/admin/release/history', noReleaseReadToken);
        assert.equal(denied.status, 403);
        assert.equal(denied.body?.error?.code, 'AUTH_FORBIDDEN');

        const dbRequired = await requestJson(baseUrl, '/admin/release/history', releaseReadToken);
        assert.equal(dbRequired.status, 503);
        assert.equal(dbRequired.body?.error?.code, 'CATALOG_DB_REQUIRED');
      },
      counters,
    );

    console.log(`Summary: ${counters.passed} passed, ${counters.failed} failed`);
    if (counters.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
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
}

main().catch((error) => {
  console.error('Integration test runner failed:', error);
  process.exit(1);
});
