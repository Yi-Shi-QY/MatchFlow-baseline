const assert = require('node:assert/strict');
const crypto = require('crypto');
const { Pool } = require('pg');
const { startServer } = require('../index');
const { issueAccessToken } = require('../src/services/tokenService');

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const TEST_USERS = {
  catalog: {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'itest_catalog_editor',
    email: 'itest_catalog_editor@example.com',
    roleCode: 'itest_catalog_editor_role',
    roleName: 'ITest Catalog Editor',
    permissions: ['catalog:datasource:edit'],
  },
  validate: {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'itest_validate_runner',
    email: 'itest_validate_runner@example.com',
    roleCode: 'itest_validate_runner_role',
    roleName: 'ITest Validate Runner',
    permissions: ['validate:run'],
  },
  releaseRead: {
    id: '33333333-3333-4333-8333-333333333333',
    username: 'itest_release_reader',
    email: 'itest_release_reader@example.com',
    roleCode: 'itest_release_reader_role',
    roleName: 'ITest Release Reader',
    permissions: ['release:read'],
  },
  releasePublish: {
    id: '44444444-4444-4444-8444-444444444444',
    username: 'itest_release_publisher',
    email: 'itest_release_publisher@example.com',
    roleCode: 'itest_release_publisher_role',
    roleName: 'ITest Release Publisher',
    permissions: ['release:publish'],
  },
  admin: {
    id: '55555555-5555-4555-8555-555555555555',
    username: 'itest_admin',
    email: 'itest_admin@example.com',
    roleCode: 'itest_admin_role',
    roleName: 'ITest Admin',
    permissions: ['admin:*'],
  },
};

function hashText(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

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

async function seedPermission(pool, code) {
  await pool.query(
    `INSERT INTO permissions (code, name, description, is_system, is_active)
     VALUES ($1, $2, $3, TRUE, TRUE)
     ON CONFLICT (code)
     DO UPDATE SET is_active = TRUE, name = EXCLUDED.name, description = EXCLUDED.description`,
    [code, code, code],
  );
}

async function seedRole(pool, roleCode, roleName) {
  const roleResult = await pool.query(
    `INSERT INTO roles (code, name, description, is_system, is_active)
     VALUES ($1, $2, $3, FALSE, TRUE)
     ON CONFLICT (code)
     DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = TRUE
     RETURNING id`,
    [roleCode, roleName, `Integration test role: ${roleCode}`],
  );
  return roleResult.rows[0].id;
}

async function assignRolePermissions(pool, roleId, permissionCodes) {
  await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
  if (!Array.isArray(permissionCodes) || permissionCodes.length === 0) {
    return;
  }
  await pool.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT $1, p.id
     FROM permissions p
     WHERE p.code = ANY($2::text[])
     ON CONFLICT (role_id, permission_id) DO NOTHING`,
    [roleId, permissionCodes],
  );
}

async function seedUser(pool, user) {
  await pool.query(
    `INSERT INTO users (id, tenant_id, username, email, display_name, password_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'active')
     ON CONFLICT (id)
     DO UPDATE SET username = EXCLUDED.username,
                   email = EXCLUDED.email,
                   display_name = EXCLUDED.display_name,
                   status = 'active'`,
    [
      user.id,
      TENANT_ID,
      user.username,
      user.email,
      user.roleName,
      'integration-password-hash',
    ],
  );
}

async function assignUserRole(pool, userId, roleId) {
  await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id, is_active)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (user_id, role_id)
     DO UPDATE SET is_active = TRUE`,
    [userId, roleId],
  );
}

async function seedAuthFixtures(pool) {
  const allPermissionCodes = new Set();
  Object.values(TEST_USERS).forEach((user) => {
    user.permissions.forEach((permission) => allPermissionCodes.add(permission));
  });

  for (const permissionCode of allPermissionCodes) {
    await seedPermission(pool, permissionCode);
  }

  for (const user of Object.values(TEST_USERS)) {
    const roleId = await seedRole(pool, user.roleCode, user.roleName);
    await assignRolePermissions(pool, roleId, user.permissions);
    await seedUser(pool, user);
    await assignUserRole(pool, user.id, roleId);
  }
}

async function mintDbBackedToken(pool, user) {
  const sessionId = crypto.randomUUID();
  const token = issueAccessToken({
    sessionId,
    userId: user.id,
    tenantId: TENANT_ID,
    roles: [],
    permissions: [],
  });

  await pool.query(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, user_agent, ip_address, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (id)
     DO UPDATE SET user_id = EXCLUDED.user_id,
                   refresh_token_hash = EXCLUDED.refresh_token_hash,
                   expires_at = EXCLUDED.expires_at,
                   revoked_at = NULL,
                   user_agent = EXCLUDED.user_agent,
                   ip_address = EXCLUDED.ip_address,
                   last_seen_at = NOW()`,
    [
      sessionId,
      user.id,
      hashText(`refresh-${sessionId}`),
      new Date(Date.now() + 24 * 60 * 60 * 1000),
      'integration-test',
      '127.0.0.1',
    ],
  );

  return token;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for runDbPhaseGate');
  }
  if (!process.env.API_KEY) {
    throw new Error('API_KEY is required for runDbPhaseGate');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const counters = { passed: 0, failed: 0 };
  let server;

  try {
    await seedAuthFixtures(pool);

    const started = startServer(0);
    server = started.server;
    if (!server.listening) {
      await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });
    }

    const address = server.address();
    if (!address || typeof address !== 'object') {
      throw new Error('Cannot resolve server address');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const apiKey = process.env.API_KEY;
    const apiHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    await runCase('phase-gate 1: planning_template invalid manifest returns 400', async () => {
      const response = await requestJson(baseUrl, '/admin/catalog/planning_template', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          itemId: `tpl_invalid_${Date.now()}`,
          version: '1.0.0',
          manifest: {
            id: 'tpl_invalid',
            name: 'Invalid Template',
            rule: 'invalid missing segments and deps',
            requiredAgents: [],
            requiredSkills: [],
            segments: [],
          },
        }),
      });
      assert.equal(response.status, 400);
      assert.equal(response.body?.error?.code, 'CATALOG_MANIFEST_SCHEMA_INVALID');
      assert.ok(Array.isArray(response.body?.error?.details?.checks));
    }, counters);

    const templateItemId = `tpl_live_${Date.now()}`;

    await runCase('phase-gate 2: planning_template create + validate success', async () => {
      const createResp = await requestJson(baseUrl, '/admin/catalog/planning_template', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          itemId: templateItemId,
          version: '1.0.0',
          status: 'draft',
          channel: 'internal',
          manifest: {
            id: templateItemId,
            name: 'Live Template',
            description: 'Template for gate validation',
            rule: 'Use for live market matches',
            requiredAgents: ['overview', 'momentum_agent'],
            requiredSkills: ['select_plan_template_v2'],
            segments: [
              {
                title: { en: 'Overview', zh: '概览' },
                focus: { en: 'Summarize', zh: '总结' },
                agentType: 'overview',
                contextMode: 'independent',
                animationType: 'scoreboard',
              },
              {
                title: { en: 'Momentum', zh: '动量' },
                focus: { en: 'Momentum shift', zh: '动量变化' },
                agentType: 'momentum_agent',
                contextMode: 'build_upon',
                animationType: 'heatmap',
              },
            ],
          },
        }),
      });
      assert.equal(createResp.status, 201);

      const runResp = await requestJson(baseUrl, '/admin/validate/run', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          runType: 'catalog_validate',
          domain: 'planning_template',
          scope: {
            itemId: templateItemId,
          },
        }),
      });
      assert.equal(runResp.status, 202);
      assert.equal(runResp.body?.data?.status, 'succeeded');
      const checks = runResp.body?.data?.result?.checks || [];
      assert.ok(checks.some((check) => check.name === 'schema'));
      assert.ok(checks.some((check) => check.name === 'dependency'));
      assert.ok(checks.some((check) => check.name === 'compatibility'));
    }, counters);

    const releaseItemId = `ds_release_${Date.now()}`;

    await runCase('phase-gate 3: publish/rollback/history workflow', async () => {
      const createV1 = await requestJson(baseUrl, '/admin/catalog/datasource', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          itemId: releaseItemId,
          version: '1.0.0',
          status: 'draft',
          channel: 'internal',
          manifest: {
            id: releaseItemId,
            name: 'Release DS',
            requiredPermissions: ['datasource:use:market'],
            fields: [
              { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
            ],
            formSections: [
              {
                id: 'market_odds',
                titleKey: 'match.market_odds',
                fields: [
                  { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
                ],
              },
            ],
          },
        }),
      });
      assert.equal(createV1.status, 201);

      const publishWithoutValidation = await requestJson(
        baseUrl,
        `/admin/catalog/datasource/${releaseItemId}/publish`,
        {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            version: '1.0.0',
            channel: 'stable',
            notes: 'publish without validation gate check',
          }),
        },
      );

      assert.equal(publishWithoutValidation.status, 409);
      assert.equal(
        publishWithoutValidation.body?.error?.code,
        'CATALOG_RELEASE_BLOCKED_BY_VALIDATION',
      );

      const validateV1 = await requestJson(baseUrl, '/admin/validate/run', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          runType: 'catalog_validate',
          domain: 'datasource',
          scope: { itemId: releaseItemId, version: '1.0.0' },
        }),
      });
      assert.equal(validateV1.status, 202);
      assert.equal(validateV1.body?.data?.status, 'succeeded');

      const publishV1 = await requestJson(
        baseUrl,
        `/admin/catalog/datasource/${releaseItemId}/publish`,
        {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            version: '1.0.0',
            channel: 'stable',
            notes: 'publish v1',
            validationRunId: validateV1.body?.data?.id,
          }),
        },
      );
      assert.equal(publishV1.status, 200);

      const createV2 = await requestJson(
        baseUrl,
        `/admin/catalog/datasource/${releaseItemId}/revisions`,
        {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            version: '1.1.0',
            status: 'draft',
            channel: 'internal',
            manifest: {
              id: releaseItemId,
              name: 'Release DS v2',
              requiredPermissions: ['datasource:use:market'],
              fields: [
                { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
                { id: 'had_away', type: 'number', path: ['odds', 'had', 'a'] },
              ],
              formSections: [
                {
                  id: 'market_odds',
                  titleKey: 'match.market_odds',
                  fields: [
                    { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
                    { id: 'had_away', type: 'number', path: ['odds', 'had', 'a'] },
                  ],
                },
              ],
            },
          }),
        },
      );
      assert.equal(createV2.status, 201);

      const saveDraftV2 = await requestJson(
        baseUrl,
        `/admin/catalog/datasource/${releaseItemId}/revisions/1.1.0`,
        {
          method: 'PUT',
          headers: apiHeaders,
          body: JSON.stringify({
            manifest: {
              id: releaseItemId,
              name: 'Release DS v2 Draft Saved',
              requiredPermissions: ['datasource:use:market'],
              fields: [
                { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
                { id: 'had_away', type: 'number', path: ['odds', 'had', 'a'] },
                { id: 'had_draw', type: 'number', path: ['odds', 'had', 'd'] },
              ],
              formSections: [
                {
                  id: 'market_odds',
                  titleKey: 'match.market_odds',
                  fields: [
                    { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
                    { id: 'had_away', type: 'number', path: ['odds', 'had', 'a'] },
                    { id: 'had_draw', type: 'number', path: ['odds', 'had', 'd'] },
                  ],
                },
              ],
            },
          }),
        },
      );
      assert.equal(saveDraftV2.status, 200);
      assert.equal(saveDraftV2.body?.data?.status, 'draft');
      assert.equal(saveDraftV2.body?.data?.manifest?.name, 'Release DS v2 Draft Saved');

      const diffV1V2 = await requestJson(
        baseUrl,
        `/admin/catalog/datasource/${releaseItemId}/diff?fromVersion=1.0.0&toVersion=1.1.0`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );
      assert.equal(diffV1V2.status, 200);
      assert.equal(diffV1V2.body?.data?.fromRevision?.version, '1.0.0');
      assert.equal(diffV1V2.body?.data?.toRevision?.version, '1.1.0');
      assert.ok((diffV1V2.body?.data?.diff?.summary?.totalChanges || 0) > 0);

      const validateV2 = await requestJson(baseUrl, '/admin/validate/run', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          runType: 'catalog_validate',
          domain: 'datasource',
          scope: { itemId: releaseItemId, version: '1.1.0' },
        }),
      });
      assert.equal(validateV2.status, 202);
      assert.equal(validateV2.body?.data?.status, 'succeeded');

      const publishV2 = await requestJson(
        baseUrl,
        `/admin/catalog/datasource/${releaseItemId}/publish`,
        {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            version: '1.1.0',
            channel: 'stable',
            notes: 'publish v2',
            validationRunId: validateV2.body?.data?.id,
          }),
        },
      );
      assert.equal(publishV2.status, 200);

      const revisionsAfterV2 = await requestJson(
        baseUrl,
        `/admin/catalog/datasource/${releaseItemId}/revisions?limit=10`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );
      assert.equal(revisionsAfterV2.status, 200);
      const revV1 = revisionsAfterV2.body?.data?.find((item) => item.version === '1.0.0');
      const revV2 = revisionsAfterV2.body?.data?.find((item) => item.version === '1.1.0');
      assert.equal(revV1?.status, 'deprecated');
      assert.equal(revV2?.status, 'published');

      const rollback = await requestJson(
        baseUrl,
        `/admin/catalog/datasource/${releaseItemId}/rollback`,
        {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            targetVersion: '1.0.0',
            channel: 'stable',
            notes: 'rollback to v1',
          }),
        },
      );
      assert.equal(rollback.status, 200);

      const revisionsAfterRollback = await requestJson(
        baseUrl,
        `/admin/catalog/datasource/${releaseItemId}/revisions?limit=10`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );
      assert.equal(revisionsAfterRollback.status, 200);
      const revV1AfterRollback = revisionsAfterRollback.body?.data?.find(
        (item) => item.version === '1.0.0',
      );
      assert.equal(revV1AfterRollback?.status, 'published');

      const history = await requestJson(baseUrl, '/admin/release/history?domain=datasource&limit=20', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      assert.equal(history.status, 200);
      const rows = history.body?.data || [];
      const actions = rows.filter((row) => row.itemId === releaseItemId).map((row) => row.action);
      assert.ok(actions.includes('publish'));
      assert.ok(actions.includes('rollback'));
    }, counters);

    await runCase('phase-gate 4: permission matrix (user tokens + DB sessions)', async () => {
      const catalogToken = await mintDbBackedToken(pool, TEST_USERS.catalog);
      const validateToken = await mintDbBackedToken(pool, TEST_USERS.validate);
      const releaseReadToken = await mintDbBackedToken(pool, TEST_USERS.releaseRead);
      const releasePublishToken = await mintDbBackedToken(pool, TEST_USERS.releasePublish);
      const adminToken = await mintDbBackedToken(pool, TEST_USERS.admin);

      const catalogAllowed = await requestJson(baseUrl, '/admin/catalog/datasource', {
        method: 'GET',
        headers: { Authorization: `Bearer ${catalogToken}` },
      });
      assert.equal(catalogAllowed.status, 200);

      const catalogDiffAllowed = await requestJson(
        baseUrl,
        '/admin/catalog/datasource/non_existing_item/diff?fromVersion=1.0.0&toVersion=1.1.0',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${catalogToken}` },
        },
      );
      assert.notEqual(catalogDiffAllowed.status, 403);

      const catalogDraftSaveAllowed = await requestJson(
        baseUrl,
        '/admin/catalog/datasource/non_existing_item/revisions/1.1.0',
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${catalogToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            manifest: {
              id: 'non_existing_item',
              name: 'Draft Save Permission Check',
              fields: [{ id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] }],
              formSections: [
                {
                  id: 'market_odds',
                  titleKey: 'match.market_odds',
                  fields: [{ id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] }],
                },
              ],
            },
          }),
        },
      );
      assert.notEqual(catalogDraftSaveAllowed.status, 403);

      const catalogDeniedValidate = await requestJson(baseUrl, '/admin/validate/run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${catalogToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runType: 'catalog_validate',
          domain: 'datasource',
          scope: { itemId: 'x1' },
        }),
      });
      assert.equal(catalogDeniedValidate.status, 403);

      const validateDeniedCatalog = await requestJson(baseUrl, '/admin/catalog/datasource', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validateToken}` },
      });
      assert.equal(validateDeniedCatalog.status, 403);

      const validateDeniedCatalogDiff = await requestJson(
        baseUrl,
        '/admin/catalog/datasource/non_existing_item/diff?fromVersion=1.0.0&toVersion=1.1.0',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${validateToken}` },
        },
      );
      assert.equal(validateDeniedCatalogDiff.status, 403);

      const validateDeniedDraftSave = await requestJson(
        baseUrl,
        '/admin/catalog/datasource/non_existing_item/revisions/1.1.0',
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${validateToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            manifest: {
              id: 'non_existing_item',
              name: 'Draft Save Permission Check',
              fields: [{ id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] }],
              formSections: [
                {
                  id: 'market_odds',
                  titleKey: 'match.market_odds',
                  fields: [{ id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] }],
                },
              ],
            },
          }),
        },
      );
      assert.equal(validateDeniedDraftSave.status, 403);

      const validateAllowed = await requestJson(baseUrl, '/admin/validate/run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validateToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runType: 'catalog_validate',
          domain: 'datasource',
          scope: { itemId: 'x1' },
        }),
      });
      assert.equal(validateAllowed.status, 202);

      const releaseReadAllowed = await requestJson(baseUrl, '/admin/release/history', {
        method: 'GET',
        headers: { Authorization: `Bearer ${releaseReadToken}` },
      });
      assert.equal(releaseReadAllowed.status, 200);

      const releaseReadDeniedPublish = await requestJson(baseUrl, '/admin/release/publish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${releaseReadToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      assert.equal(releaseReadDeniedPublish.status, 403);

      const releasePublishAllowed = await requestJson(baseUrl, '/admin/release/publish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${releasePublishToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      assert.equal(releasePublishAllowed.status, 400);

      const releasePublishDeniedRead = await requestJson(baseUrl, '/admin/release/history', {
        method: 'GET',
        headers: { Authorization: `Bearer ${releasePublishToken}` },
      });
      assert.equal(releasePublishDeniedRead.status, 403);

      const adminCanReadUsers = await requestJson(baseUrl, '/admin/users?limit=1', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(adminCanReadUsers.status, 200);
    }, counters);

    await runCase('phase-gate 5: audit log coverage for key actions', async () => {
      const result = await pool.query(
        `SELECT action, COUNT(*)::int AS count
         FROM audit_logs
         WHERE action IN (
           'studio.catalog.create',
           'studio.catalog.revision.create',
           'studio.validation.run',
           'studio.catalog.publish',
           'studio.catalog.rollback'
         )
         GROUP BY action`,
      );
      const map = new Map(result.rows.map((row) => [row.action, row.count]));

      assert.ok((map.get('studio.catalog.create') || 0) > 0);
      assert.ok((map.get('studio.catalog.revision.create') || 0) > 0);
      assert.ok((map.get('studio.validation.run') || 0) > 0);
      assert.ok((map.get('studio.catalog.publish') || 0) > 0);
      assert.ok((map.get('studio.catalog.rollback') || 0) > 0);
    }, counters);

    await runCase('phase-gate 6: duplicate itemId+version conflict returns 409', async () => {
      const conflictItemId = `ds_conflict_${Date.now()}`;
      const body = {
        itemId: conflictItemId,
        version: '1.0.0',
        status: 'draft',
        channel: 'internal',
        manifest: {
          id: conflictItemId,
          name: 'Conflict DS',
          requiredPermissions: ['datasource:use:market'],
          fields: [
            { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
          ],
          formSections: [
            {
              id: 'market_odds',
              titleKey: 'match.market_odds',
              fields: [
                { id: 'had_home', type: 'number', path: ['odds', 'had', 'h'] },
              ],
            },
          ],
        },
      };

      const first = await requestJson(baseUrl, '/admin/catalog/datasource', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify(body),
      });
      assert.equal(first.status, 201);

      const second = await requestJson(baseUrl, '/admin/catalog/datasource', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify(body),
      });
      assert.equal(second.status, 409);
      assert.equal(second.body?.error?.code, 'CATALOG_REVISION_CONFLICT');
    }, counters);

    console.log(`SUMMARY: ${counters.passed} passed, ${counters.failed} failed`);
    if (counters.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    try {
      await pool.end();
    } catch (error) {
      console.error('Failed to close pg pool:', error.message);
    }

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) return reject(error);
          resolve();
        });
      });
    }
  }
}

main().catch((error) => {
  console.error('DB phase gate runner crashed');
  console.error(error);
  process.exit(1);
});
