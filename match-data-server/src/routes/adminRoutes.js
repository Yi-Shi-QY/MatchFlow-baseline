const fs = require('fs');
const path = require('path');
const db = require('../../db');
const matchRepository = require('../repositories/matchRepository');
const { hasPermission } = require('../services/permissionService');
const {
  normalizeKind,
  listManifestRecords,
  upsertManifest,
  updateManifest,
  publishManifest,
} = require('../services/hubManifestService');
const {
  AdminIdentityError,
  listUsersForAdmin,
  createUserForAdmin,
  updateUserForAdmin,
  setUserRolesForAdmin,
  listRolesForAdmin,
  createRoleForAdmin,
  updateRoleForAdmin,
  setRolePermissionsForAdmin,
  listPermissionsForAdmin,
  createPermissionForAdmin,
  listAuditLogsForAdmin,
} = require('../services/adminIdentityService');
const {
  StudioCatalogError,
  getCatalogEditPermission,
  previewDatasourceStructureForAdmin,
  previewDatasourceDataForAdmin,
  previewAgentModelRunForAdmin,
  previewSkillInvocationForAdmin,
  listCatalogEntriesForAdmin,
  createCatalogEntryForAdmin,
  listCatalogRevisionsForAdmin,
  createCatalogRevisionForAdmin,
  updateCatalogDraftRevisionForAdmin,
  getCatalogRevisionDiffForAdmin,
  publishCatalogRevisionForAdmin,
  rollbackCatalogRevisionForAdmin,
  runValidationForAdmin,
  getValidationRunForAdmin,
  publishReleaseForAdmin,
  rollbackReleaseForAdmin,
  listReleaseHistoryForAdmin,
} = require('../services/studioCatalogService');
const {
  listDatasourceCollectorsForAdmin,
  createDatasourceCollectorForAdmin,
  updateDatasourceCollectorForAdmin,
  triggerDatasourceCollectorRunForAdmin,
  importDatasourceCollectionSnapshotForAdmin,
  listDatasourceCollectionRunsForAdmin,
  listDatasourceCollectionSnapshotsForAdmin,
  listDatasourceCollectionHealthForAdmin,
  confirmDatasourceCollectionSnapshotForAdmin,
  releaseDatasourceCollectionSnapshotForAdmin,
  replayDatasourceCollectionSnapshotForAdmin,
} = require('../services/datasourceCollectionService');

function parseStatuses(input) {
  if (Array.isArray(input)) {
    return input
      .flatMap((value) => String(value).split(','))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
  if (typeof input === 'string' && input.trim().length > 0) {
    return input
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
  return undefined;
}

function loadMigrationSqlFiles() {
  const migrationDir = path.join(__dirname, '../../migrations');
  if (!fs.existsSync(migrationDir)) {
    return [];
  }

  const files = fs
    .readdirSync(migrationDir)
    .filter((filename) => filename.toLowerCase().endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  return files.map((filename) => ({
    filename,
    sql: fs.readFileSync(path.join(migrationDir, filename), 'utf8'),
  }));
}

function forbidden(res, message) {
  return res.status(403).json({
    error: {
      code: 'AUTH_FORBIDDEN',
      message,
    },
  });
}

function withAdminPermission(handler) {
  return async (req, res) => {
    if (!hasPermission(req.authContext, 'admin:*')) {
      return forbidden(res, 'Missing admin permission: admin:*');
    }
    return handler(req, res);
  };
}

function handleAdminIdentityError(res, error, fallbackMessage) {
  if (error instanceof AdminIdentityError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (String(error?.message || '').includes('Database not connected')) {
    return res.status(503).json({
      error: {
        code: 'ADMIN_DB_REQUIRED',
        message: 'Database not connected',
      },
    });
  }

  console.error('[admin-identity]', fallbackMessage, error);
  return res.status(500).json({
    error: {
      code: 'ADMIN_INTERNAL_ERROR',
      message: fallbackMessage,
    },
  });
}

function handleStudioCatalogError(res, error, fallbackMessage) {
  if (error instanceof StudioCatalogError) {
    const payload = {
      code: error.code,
      message: error.message,
    };
    if (error.details !== undefined && error.details !== null) {
      payload.details = error.details;
    }

    return res.status(error.statusCode).json({
      error: payload,
    });
  }

  if (String(error?.message || '').includes('Database not connected')) {
    return res.status(503).json({
      error: {
        code: 'CATALOG_DB_REQUIRED',
        message: 'Database not connected',
      },
    });
  }

  console.error('[studio-catalog]', fallbackMessage, error);
  return res.status(500).json({
    error: {
      code: 'CATALOG_INTERNAL_ERROR',
      message: fallbackMessage,
    },
  });
}

function withRequiredPermission(permissionInput, handler) {
  return async (req, res) => {
    let permission;
    try {
      permission = typeof permissionInput === 'function' ? permissionInput(req) : permissionInput;
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to resolve required permission');
    }
    if (!permission || !hasPermission(req.authContext, permission)) {
      return forbidden(res, `Missing required permission: ${permission || 'unknown'}`);
    }
    return handler(req, res);
  };
}

function registerAdminRoutes(app, authenticate) {
  app.post('/admin/init', authenticate, withAdminPermission(async (req, res) => {
    if (!db.isConnected()) {
      return res.status(500).json({ error: { message: 'Database not connected' } });
    }

    try {
      const schemaPath = path.join(__dirname, '../../schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await db.query(schemaSql);

      const migrationFiles = loadMigrationSqlFiles();
      for (const migration of migrationFiles) {
        await db.query(migration.sql);
      }

      return res.json({
        message: 'Database initialized successfully',
        migrationsApplied: migrationFiles.map((migration) => migration.filename),
      });
    } catch (err) {
      console.error('Init error:', err);
      return res.status(500).json({
        error: { message: 'Failed to initialize database', details: err.message },
      });
    }
  }));

  app.post('/admin/teams', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await matchRepository.upsertTeam(req.body || {});
      return res.json({ data });
    } catch (err) {
      const message = err?.message || 'Failed to upsert team';
      if (message.includes('required')) {
        return res.status(400).json({ error: { message } });
      }
      if (message.includes('Database not connected')) {
        return res.status(500).json({ error: { message } });
      }
      console.error('Team upsert error:', err);
      return res.status(500).json({ error: { message: 'Failed to upsert team' } });
    }
  }));

  app.post('/admin/matches', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await matchRepository.upsertMatch(req.body || {});
      return res.json({ data });
    } catch (err) {
      const message = err?.message || 'Failed to upsert match';
      if (message.includes('Missing required match fields')) {
        return res.status(400).json({ error: { message } });
      }
      if (message.includes('Database not connected')) {
        return res.status(500).json({ error: { message } });
      }
      console.error('Match upsert error:', err);
      return res.status(500).json({
        error: { message: 'Failed to upsert match', details: err.message },
      });
    }
  }));

  app.put('/admin/matches/:id/score', authenticate, withAdminPermission(async (req, res) => {
    const { id } = req.params;
    try {
      const data = await matchRepository.updateMatchScore(id, req.body || {});
      if (!data) {
        return res.status(404).json({ error: { message: 'Match not found' } });
      }
      return res.json({ data });
    } catch (err) {
      console.error('Match update error:', err);
      return res.status(500).json({ error: { message: 'Failed to update match' } });
    }
  }));

  app.delete('/admin/matches/:id', authenticate, withAdminPermission(async (req, res) => {
    const { id } = req.params;
    try {
      const deleted = await matchRepository.deleteMatch(id);
      if (!deleted) {
        return res.status(404).json({ error: { message: 'Match not found' } });
      }
      return res.json({ message: 'Match deleted successfully' });
    } catch (err) {
      console.error('Match delete error:', err);
      return res.status(500).json({ error: { message: 'Failed to delete match' } });
    }
  }));

  app.delete('/admin/teams/:id', authenticate, withAdminPermission(async (req, res) => {
    const { id } = req.params;
    try {
      const deleted = await matchRepository.deleteTeam(id);
      if (!deleted) {
        return res.status(404).json({ error: { message: 'Team not found' } });
      }
      return res.json({ message: 'Team deleted successfully' });
    } catch (err) {
      const message = err?.message || 'Failed to delete team';
      if (message.includes('mock mode')) {
        return res.status(400).json({ error: { message } });
      }
      console.error('Team delete error:', err);
      return res.status(500).json({
        error: { message: 'Failed to delete team. It might be referenced by existing matches.' },
      });
    }
  }));

  app.get('/admin/extensions', authenticate, withAdminPermission(async (req, res) => {
    const kind = req.query.kind ? normalizeKind(req.query.kind) : undefined;
    const extensionId =
      typeof req.query.id === 'string' && req.query.id.trim().length > 0
        ? req.query.id.trim()
        : undefined;
    const channel =
      typeof req.query.channel === 'string' && req.query.channel.trim().length > 0
        ? req.query.channel.trim()
        : undefined;
    const statuses = parseStatuses(req.query.status || req.query.statuses);
    const limit =
      typeof req.query.limit === 'string' && req.query.limit.trim().length > 0
        ? Number(req.query.limit)
        : undefined;
    const offset =
      typeof req.query.offset === 'string' && req.query.offset.trim().length > 0
        ? Number(req.query.offset)
        : undefined;

    try {
      const data = await listManifestRecords({
        kind,
        extensionId,
        channel,
        statuses,
        limit,
        offset,
      });
      return res.json({ data, count: data.length });
    } catch (err) {
      console.error('List extension error:', err);
      return res.status(500).json({ error: { message: 'Failed to list extension manifests' } });
    }
  }));

  app.post('/admin/extensions', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await upsertManifest(req.body || {});
      return res.json({ data });
    } catch (err) {
      const message = err?.message || 'Failed to upsert extension manifest';
      return res.status(400).json({ error: { message } });
    }
  }));

  app.put('/admin/extensions/:kind/:id/:version', authenticate, withAdminPermission(async (req, res) => {
    const kind = normalizeKind(req.params.kind);
    const extensionId = req.params.id;
    const version = req.params.version;
    const patch = req.body || {};

    try {
      const data = await updateManifest(kind, extensionId, version, patch);
      if (!data) {
        return res.status(404).json({ error: { message: 'Extension manifest not found' } });
      }
      return res.json({ data });
    } catch (err) {
      const message = err?.message || 'Failed to update extension manifest';
      return res.status(400).json({ error: { message } });
    }
  }));

  app.post('/admin/extensions/publish', authenticate, withAdminPermission(async (req, res) => {
    const kind = normalizeKind(req.body?.kind);
    const extensionId = typeof req.body?.id === 'string' ? req.body.id : '';
    const version = typeof req.body?.version === 'string' ? req.body.version : '';

    if (!kind || !extensionId || !version) {
      return res.status(400).json({
        error: { message: 'kind, id, and version are required to publish extension manifest' },
      });
    }

    try {
      const data = await publishManifest(kind, extensionId, version);
      if (!data) {
        return res.status(404).json({ error: { message: 'Extension manifest not found' } });
      }
      return res.json({ data });
    } catch (err) {
      const message = err?.message || 'Failed to publish extension manifest';
      return res.status(400).json({ error: { message } });
    }
  }));

  app.get('/admin/users', authenticate, withAdminPermission(async (req, res) => {
    try {
      const result = await listUsersForAdmin({
        tenantId: req.query.tenantId,
        status: req.query.status,
        search: req.query.search,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return res.json(result);
    } catch (error) {
      return handleAdminIdentityError(res, error, 'Failed to list users');
    }
  }));

  app.post('/admin/users', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await createUserForAdmin(req.body || {}, req.authContext);
      return res.status(201).json({ data });
    } catch (error) {
      return handleAdminIdentityError(res, error, 'Failed to create user');
    }
  }));

  app.put('/admin/users/:id', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await updateUserForAdmin(req.params.id, req.body || {}, req.authContext);
      return res.json({ data });
    } catch (error) {
      return handleAdminIdentityError(res, error, 'Failed to update user');
    }
  }));

  app.post('/admin/users/:id/roles', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await setUserRolesForAdmin(req.params.id, req.body || {}, req.authContext);
      return res.json({ data });
    } catch (error) {
      return handleAdminIdentityError(res, error, 'Failed to set user roles');
    }
  }));

  app.get('/admin/roles', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await listRolesForAdmin();
      return res.json({ data, count: data.length });
    } catch (error) {
      return handleAdminIdentityError(res, error, 'Failed to list roles');
    }
  }));

  app.post('/admin/roles', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await createRoleForAdmin(req.body || {}, req.authContext);
      return res.status(201).json({ data });
    } catch (error) {
      return handleAdminIdentityError(res, error, 'Failed to create role');
    }
  }));

  app.put('/admin/roles/:id', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await updateRoleForAdmin(req.params.id, req.body || {}, req.authContext);
      return res.json({ data });
    } catch (error) {
      return handleAdminIdentityError(res, error, 'Failed to update role');
    }
  }));

  app.post('/admin/roles/:id/permissions', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await setRolePermissionsForAdmin(req.params.id, req.body || {}, req.authContext);
      return res.json({ data });
    } catch (error) {
      return handleAdminIdentityError(res, error, 'Failed to set role permissions');
    }
  }));

  app.get('/admin/permissions', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await listPermissionsForAdmin();
      return res.json({ data, count: data.length });
    } catch (error) {
      return handleAdminIdentityError(res, error, 'Failed to list permissions');
    }
  }));

  app.post('/admin/permissions', authenticate, withAdminPermission(async (req, res) => {
    try {
      const data = await createPermissionForAdmin(req.body || {}, req.authContext);
      return res.status(201).json({ data });
    } catch (error) {
      return handleAdminIdentityError(res, error, 'Failed to create permission');
    }
  }));

  app.get('/admin/audit-logs', authenticate, withAdminPermission(async (req, res) => {
    try {
      const result = await listAuditLogsForAdmin({
        tenantId: req.query.tenantId,
        action: req.query.action,
        actorUserId: req.query.actorUserId,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return res.json(result);
    } catch (error) {
      return handleAdminIdentityError(res, error, 'Failed to list audit logs');
    }
  }));

  app.get('/admin/catalog/:domain', authenticate, withRequiredPermission((req) => getCatalogEditPermission(req.params.domain), async (req, res) => {
    try {
      const result = await listCatalogEntriesForAdmin({
        domain: req.params.domain,
        query: req.query,
        authContext: req.authContext,
      });
      return res.json(result);
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to list catalog entries');
    }
  }));

  app.post('/admin/catalog/:domain', authenticate, withRequiredPermission((req) => getCatalogEditPermission(req.params.domain), async (req, res) => {
    try {
      const data = await createCatalogEntryForAdmin({
        domain: req.params.domain,
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.status(201).json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to create catalog entry');
    }
  }));

  app.post('/admin/catalog/datasource/preview/structure', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const data = await previewDatasourceStructureForAdmin({
        body: req.body || {},
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to build datasource structure preview');
    }
  }));

  app.post('/admin/catalog/datasource/preview/data', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const data = await previewDatasourceDataForAdmin({
        body: req.body || {},
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to build datasource data preview');
    }
  }));

  app.post('/admin/catalog/agent/preview/model', authenticate, withRequiredPermission(() => getCatalogEditPermission('agent'), async (req, res) => {
    try {
      const data = await previewAgentModelRunForAdmin({
        body: req.body || {},
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to run agent model preview');
    }
  }));

  app.post('/admin/catalog/skill/preview/model', authenticate, withRequiredPermission(() => getCatalogEditPermission('skill'), async (req, res) => {
    try {
      const data = await previewSkillInvocationForAdmin({
        body: req.body || {},
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to run skill invocation preview');
    }
  }));

  app.get('/admin/data-collections/collectors', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const result = await listDatasourceCollectorsForAdmin({
        query: req.query,
        authContext: req.authContext,
      });
      return res.json(result);
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to list datasource collectors');
    }
  }));

  app.post('/admin/data-collections/collectors', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const data = await createDatasourceCollectorForAdmin({
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.status(201).json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to create datasource collector');
    }
  }));

  app.put('/admin/data-collections/collectors/:collectorId', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const data = await updateDatasourceCollectorForAdmin({
        collectorId: req.params.collectorId,
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to update datasource collector');
    }
  }));

  app.post('/admin/data-collections/collectors/:collectorId/run', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const data = await triggerDatasourceCollectorRunForAdmin({
        collectorId: req.params.collectorId,
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.status(202).json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to trigger datasource collector run');
    }
  }));

  app.post('/admin/data-collections/collectors/:collectorId/import', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const data = await importDatasourceCollectionSnapshotForAdmin({
        collectorId: req.params.collectorId,
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.status(202).json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to import datasource collection snapshot');
    }
  }));

  app.get('/admin/data-collections/runs', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const result = await listDatasourceCollectionRunsForAdmin({
        query: req.query,
        authContext: req.authContext,
      });
      return res.json(result);
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to list datasource collection runs');
    }
  }));

  app.get('/admin/data-collections/snapshots', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const result = await listDatasourceCollectionSnapshotsForAdmin({
        query: req.query,
        authContext: req.authContext,
      });
      return res.json(result);
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to list datasource collection snapshots');
    }
  }));

  app.get('/admin/data-collections/health', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const result = await listDatasourceCollectionHealthForAdmin({
        query: req.query,
        authContext: req.authContext,
      });
      return res.json(result);
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to list datasource collection health');
    }
  }));

  app.post('/admin/data-collections/snapshots/:snapshotId/confirm', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const data = await confirmDatasourceCollectionSnapshotForAdmin({
        snapshotId: req.params.snapshotId,
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to confirm datasource collection snapshot');
    }
  }));

  app.post('/admin/data-collections/snapshots/:snapshotId/release', authenticate, withRequiredPermission('release:publish', async (req, res) => {
    try {
      const data = await releaseDatasourceCollectionSnapshotForAdmin({
        snapshotId: req.params.snapshotId,
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to release datasource collection snapshot');
    }
  }));

  app.post('/admin/data-collections/snapshots/:snapshotId/replay', authenticate, withRequiredPermission(() => getCatalogEditPermission('datasource'), async (req, res) => {
    try {
      const data = await replayDatasourceCollectionSnapshotForAdmin({
        snapshotId: req.params.snapshotId,
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.status(202).json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to replay datasource collection snapshot');
    }
  }));

  app.get('/admin/catalog/:domain/:itemId/revisions', authenticate, withRequiredPermission((req) => getCatalogEditPermission(req.params.domain), async (req, res) => {
    try {
      const result = await listCatalogRevisionsForAdmin({
        domain: req.params.domain,
        itemId: req.params.itemId,
        query: req.query,
        authContext: req.authContext,
      });
      return res.json(result);
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to list catalog revisions');
    }
  }));

  app.get('/admin/catalog/:domain/:itemId/diff', authenticate, withRequiredPermission((req) => getCatalogEditPermission(req.params.domain), async (req, res) => {
    try {
      const data = await getCatalogRevisionDiffForAdmin({
        domain: req.params.domain,
        itemId: req.params.itemId,
        query: req.query,
        authContext: req.authContext,
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to diff catalog revisions');
    }
  }));

  app.post('/admin/catalog/:domain/:itemId/revisions', authenticate, withRequiredPermission((req) => getCatalogEditPermission(req.params.domain), async (req, res) => {
    try {
      const data = await createCatalogRevisionForAdmin({
        domain: req.params.domain,
        itemId: req.params.itemId,
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.status(201).json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to create catalog revision');
    }
  }));

  app.put('/admin/catalog/:domain/:itemId/revisions/:version', authenticate, withRequiredPermission((req) => getCatalogEditPermission(req.params.domain), async (req, res) => {
    try {
      const data = await updateCatalogDraftRevisionForAdmin({
        domain: req.params.domain,
        itemId: req.params.itemId,
        version: req.params.version,
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to save catalog draft revision');
    }
  }));

  app.post('/admin/catalog/:domain/:itemId/publish', authenticate, withRequiredPermission('release:publish', async (req, res) => {
    try {
      const data = await publishCatalogRevisionForAdmin({
        domain: req.params.domain,
        itemId: req.params.itemId,
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to publish catalog revision');
    }
  }));

  app.post('/admin/catalog/:domain/:itemId/rollback', authenticate, withRequiredPermission('release:rollback', async (req, res) => {
    try {
      const data = await rollbackCatalogRevisionForAdmin({
        domain: req.params.domain,
        itemId: req.params.itemId,
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to rollback catalog revision');
    }
  }));

  app.post('/admin/validate/run', authenticate, withRequiredPermission('validate:run', async (req, res) => {
    try {
      const data = await runValidationForAdmin({
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.status(202).json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to trigger validation run');
    }
  }));

  app.get('/admin/validate/:runId', authenticate, withRequiredPermission('validate:run', async (req, res) => {
    try {
      const data = await getValidationRunForAdmin({ runId: req.params.runId });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to read validation run');
    }
  }));

  app.post('/admin/release/publish', authenticate, withRequiredPermission('release:publish', async (req, res) => {
    try {
      const data = await publishReleaseForAdmin({
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to publish release');
    }
  }));

  app.post('/admin/release/rollback', authenticate, withRequiredPermission('release:rollback', async (req, res) => {
    try {
      const data = await rollbackReleaseForAdmin({
        body: req.body || {},
        authContext: req.authContext,
      });
      return res.json({ data });
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to rollback release');
    }
  }));

  app.get('/admin/release/history', authenticate, withRequiredPermission('release:read', async (req, res) => {
    try {
      const result = await listReleaseHistoryForAdmin({
        query: req.query,
        authContext: req.authContext,
      });
      return res.json(result);
    } catch (error) {
      return handleStudioCatalogError(res, error, 'Failed to list release history');
    }
  }));
}

module.exports = {
  registerAdminRoutes,
};
