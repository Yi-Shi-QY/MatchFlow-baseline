const crypto = require('crypto');
const db = require('../../db');
const { StudioCatalogError } = require('./studioCatalogService');
const {
  listCollectors,
  createCollector,
  getCollectorById,
  updateCollectorById,
  listCollectionRuns,
  createCollectionRun,
  updateCollectionRunById,
  listCollectionSnapshots,
  createCollectionSnapshot,
  findLatestSnapshotByContentHash,
  getCollectionSnapshotById,
  updateCollectionSnapshotById,
  releaseSnapshotAndDeprecatePrevious,
} = require('../repositories/datasourceCollectionRepository');
const { insertAuditLog } = require('../repositories/studioCatalogRepository');

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SOURCE_ID_PATTERN = /^[a-z0-9_][a-z0-9_-]{1,63}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_HASH_PATTERN = /^[a-f0-9]{32,128}$/i;
const ALLOWED_PROVIDERS = new Set(['match_snapshot', 'manual_import']);
const ALLOWED_TRIGGER_TYPES = new Set(['manual', 'scheduled', 'retry']);
const ALLOWED_RUN_STATUSES = new Set(['queued', 'running', 'succeeded', 'failed', 'canceled']);
const ALLOWED_CONFIRMATION_STATUSES = new Set(['pending', 'confirmed', 'rejected']);
const ALLOWED_RELEASE_STATUSES = new Set(['draft', 'released', 'deprecated']);
const ALLOWED_RELEASE_CHANNELS = new Set(['internal', 'beta', 'stable']);
const MAX_IMPORT_RECORD_COUNT = (() => {
  const parsed = Number.parseInt(process.env.COLLECTION_MAX_IMPORT_RECORDS, 10);
  if (!Number.isFinite(parsed)) {
    return 20_000;
  }
  return Math.max(100, Math.min(parsed, 200_000));
})();
const MAX_IMPORT_PAYLOAD_BYTES = (() => {
  const parsed = Number.parseInt(process.env.COLLECTION_MAX_IMPORT_PAYLOAD_BYTES, 10);
  if (!Number.isFinite(parsed)) {
    return 8 * 1024 * 1024;
  }
  return Math.max(256 * 1024, Math.min(parsed, 64 * 1024 * 1024));
})();
const DEFAULT_COLLECTION_SLA_MAX_LAG_MINUTES = (() => {
  const parsed = Number.parseInt(process.env.COLLECTION_SLA_MAX_LAG_MINUTES, 10);
  if (!Number.isFinite(parsed)) {
    return 180;
  }
  return Math.max(5, Math.min(parsed, 7 * 24 * 60));
})();

function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseBooleanInput(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  throw new StudioCatalogError('boolean query param is invalid', 'COLLECTION_QUERY_INVALID', 400);
}

function parseBooleanBodyInput(value, fallbackValue = false) {
  if (value === undefined || value === null || value === '') {
    return fallbackValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  throw new StudioCatalogError('boolean body field is invalid', 'COLLECTION_INPUT_INVALID', 400);
}

function normalizeStatusList(input) {
  if (Array.isArray(input)) {
    return Array.from(
      new Set(
        input
          .flatMap((item) => String(item).split(','))
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    );
  }

  const normalized = normalizeString(input);
  if (!normalized) {
    return [];
  }

  return Array.from(
    new Set(
      normalized
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

function normalizeCollectorProvider(providerInput, fallback = 'match_snapshot') {
  const provider = normalizeString(providerInput) || fallback;
  if (!ALLOWED_PROVIDERS.has(provider)) {
    throw new StudioCatalogError('collector provider is invalid', 'COLLECTION_PROVIDER_INVALID', 400);
  }
  return provider;
}

function normalizeTriggerType(triggerInput, fallback = 'manual') {
  const triggerType = normalizeString(triggerInput) || fallback;
  if (!ALLOWED_TRIGGER_TYPES.has(triggerType)) {
    throw new StudioCatalogError('triggerType is invalid', 'COLLECTION_TRIGGER_TYPE_INVALID', 400);
  }
  return triggerType;
}

function normalizeReleaseChannel(channelInput, fallback = 'internal') {
  const channel = normalizeString(channelInput) || fallback;
  if (!ALLOWED_RELEASE_CHANNELS.has(channel)) {
    throw new StudioCatalogError('release channel is invalid', 'COLLECTION_RELEASE_CHANNEL_INVALID', 400);
  }
  return channel;
}

function ensureSourceId(sourceIdInput) {
  const sourceId = normalizeString(sourceIdInput);
  if (!sourceId) {
    throw new StudioCatalogError('sourceId is required', 'COLLECTION_SOURCE_ID_REQUIRED', 400);
  }
  if (!SOURCE_ID_PATTERN.test(sourceId)) {
    throw new StudioCatalogError(
      'sourceId must match pattern [a-z0-9_][a-z0-9_-]{1,63}',
      'COLLECTION_SOURCE_ID_INVALID',
      400,
    );
  }
  return sourceId;
}

function ensureCollectorName(nameInput) {
  const name = normalizeString(nameInput);
  if (!name) {
    throw new StudioCatalogError('collector name is required', 'COLLECTION_NAME_REQUIRED', 400);
  }
  if (name.length > 255) {
    throw new StudioCatalogError('collector name is too long', 'COLLECTION_NAME_INVALID', 400);
  }
  return name;
}

function ensureCollectorId(collectorIdInput) {
  const collectorId = normalizeString(collectorIdInput);
  if (!collectorId) {
    throw new StudioCatalogError('collectorId is required', 'COLLECTION_COLLECTOR_ID_REQUIRED', 400);
  }
  if (!UUID_PATTERN.test(collectorId)) {
    throw new StudioCatalogError('collectorId is invalid', 'COLLECTION_COLLECTOR_ID_INVALID', 400);
  }
  return collectorId;
}

function ensureSnapshotId(snapshotIdInput) {
  const snapshotId = normalizeString(snapshotIdInput);
  if (!snapshotId) {
    throw new StudioCatalogError('snapshotId is required', 'COLLECTION_SNAPSHOT_ID_REQUIRED', 400);
  }
  if (!UUID_PATTERN.test(snapshotId)) {
    throw new StudioCatalogError('snapshotId is invalid', 'COLLECTION_SNAPSHOT_ID_INVALID', 400);
  }
  return snapshotId;
}

function normalizeConfigObject(configInput) {
  if (configInput === undefined || configInput === null || configInput === '') {
    return {};
  }
  if (!isPlainObject(configInput)) {
    throw new StudioCatalogError('collector config must be an object', 'COLLECTION_CONFIG_INVALID', 400);
  }
  return configInput;
}

function normalizePayloadObject(payloadInput) {
  if (!isPlainObject(payloadInput)) {
    throw new StudioCatalogError(
      'payload must be a JSON object',
      'COLLECTION_IMPORT_PAYLOAD_INVALID',
      400,
    );
  }
  return payloadInput;
}

function normalizeContentHashInput(contentHashInput) {
  const normalized = normalizeString(contentHashInput);
  if (!normalized) {
    return '';
  }
  if (!CONTENT_HASH_PATTERN.test(normalized)) {
    throw new StudioCatalogError(
      'contentHash must be a hex string',
      'COLLECTION_IMPORT_CONTENT_HASH_INVALID',
      400,
    );
  }
  return normalized.toLowerCase();
}

function estimatePayloadBytes(payload) {
  return Buffer.byteLength(JSON.stringify(payload || {}), 'utf8');
}

function normalizeSampleLimit(limitInput, fallback = 20) {
  const parsed = Number.parseInt(limitInput, 10);
  const normalizedFallback = Number.isFinite(fallback) ? fallback : 20;
  if (!Number.isFinite(parsed)) {
    return Math.max(1, Math.min(normalizedFallback, 200));
  }
  return Math.max(1, Math.min(parsed, 200));
}

function normalizePositiveInteger(input, fallbackValue, min, max) {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }
  return Math.max(min, Math.min(parsed, max));
}

function resolveTenantId(authContext, requestedTenantId) {
  const requested = normalizeString(requestedTenantId);
  if (requested) {
    return requested;
  }
  const authTenant = normalizeString(authContext?.tenantId);
  if (authTenant) {
    return authTenant;
  }
  return DEFAULT_TENANT_ID;
}

function resolveActorUserId(authContext) {
  const userId = normalizeString(authContext?.userId);
  return userId || null;
}

function checksumPayload(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
}

function mapMatchRowToSnapshotRecord(row) {
  const homeTeam = row?.hometeam || row?.homeTeam || null;
  const awayTeam = row?.awayteam || row?.awayTeam || null;
  return {
    id: row?.id || null,
    league: row?.league_name || null,
    date: row?.match_date || null,
    status: row?.status || null,
    score: {
      home: row?.home_score ?? null,
      away: row?.away_score ?? null,
    },
    stats: row?.match_stats || {},
    odds: row?.odds || {},
    homeTeam: homeTeam
      ? {
        id: homeTeam.id || null,
        name: homeTeam.name || null,
        logo: homeTeam.logo_url || null,
      }
      : null,
    awayTeam: awayTeam
      ? {
        id: awayTeam.id || null,
        name: awayTeam.name || null,
        logo: awayTeam.logo_url || null,
      }
      : null,
  };
}

async function writeAuditEvent({
  authContext,
  tenantId,
  action,
  targetType,
  targetId,
  beforeState,
  afterState,
  metadata,
}) {
  await insertAuditLog({
    actorUserId: resolveActorUserId(authContext),
    tenantId,
    action,
    targetType,
    targetId,
    beforeState: beforeState || null,
    afterState: afterState || null,
    metadata: metadata || {},
  });
}

function ensureAllowedStatus(value, allowedSet, codePrefix, fieldName) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }
  if (!allowedSet.has(normalized)) {
    throw new StudioCatalogError(
      `${fieldName} is invalid`,
      `${codePrefix}_INVALID`,
      400,
    );
  }
  return normalized;
}

function resolveCollectorSlaMaxLagMinutes(collector, fallbackValue) {
  const collectorConfig = isPlainObject(collector?.config) ? collector.config : {};
  const configured = normalizePositiveInteger(
    collectorConfig.slaMaxLagMinutes,
    fallbackValue,
    5,
    7 * 24 * 60,
  );
  return configured;
}

function resolveCollectorHealth(collector, latestRun, now, fallbackSlaMinutes) {
  const lastRunAtValue = collector?.lastRunAt || latestRun?.finishedAt || latestRun?.startedAt || null;
  const lastRunAt = lastRunAtValue ? new Date(lastRunAtValue) : null;
  const lagMinutes = lastRunAt ? Math.floor((now - lastRunAt.getTime()) / 60000) : null;
  const slaMaxLagMinutes = resolveCollectorSlaMaxLagMinutes(collector, fallbackSlaMinutes);
  let status = 'healthy';
  const reasons = [];

  if (!collector?.isEnabled) {
    status = 'disabled';
    reasons.push('collector_disabled');
  } else if (!lastRunAt) {
    status = 'never_run';
    reasons.push('collector_never_run');
  } else if (collector?.lastRunStatus === 'failed' || latestRun?.status === 'failed') {
    status = 'failed';
    reasons.push('last_run_failed');
  } else if (lagMinutes !== null && lagMinutes > slaMaxLagMinutes) {
    status = 'stale';
    reasons.push('run_lag_exceeded');
  }

  return {
    status,
    reasons,
    lastRunStatus: latestRun?.status || collector?.lastRunStatus || 'idle',
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
    lagMinutes,
    slaMaxLagMinutes,
  };
}

async function listDatasourceCollectorsForAdmin({ query, authContext }) {
  try {
    const tenantId = resolveTenantId(authContext, query?.tenantId);
    return await listCollectors({
      tenantId,
      sourceId: query?.sourceId,
      isEnabled: parseBooleanInput(query?.isEnabled),
      limit: query?.limit,
      offset: query?.offset,
    });
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function createDatasourceCollectorForAdmin({ body, authContext }) {
  const tenantId = resolveTenantId(authContext, body?.tenantId);
  const sourceId = ensureSourceId(body?.sourceId);
  const name = ensureCollectorName(body?.name);
  const provider = normalizeCollectorProvider(body?.provider, 'match_snapshot');
  const config = normalizeConfigObject(body?.config);
  const scheduleCron = normalizeString(body?.scheduleCron) || null;
  const isEnabled = body?.isEnabled !== false;

  try {
    const created = await createCollector({
      tenantId,
      sourceId,
      name,
      provider,
      config,
      scheduleCron,
      isEnabled,
      createdByUserId: resolveActorUserId(authContext),
    });

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'datasource.collection.collector.create',
      targetType: 'datasource_collector',
      targetId: created.id,
      beforeState: null,
      afterState: created,
      metadata: {
        sourceId,
        provider,
      },
    });

    return created;
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      throw new StudioCatalogError(
        'collector already exists for source/name',
        'COLLECTION_COLLECTOR_CONFLICT',
        409,
      );
    }
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function updateDatasourceCollectorForAdmin({ collectorId, body, authContext }) {
  const normalizedCollectorId = ensureCollectorId(collectorId);
  const tenantId = resolveTenantId(authContext, body?.tenantId);
  const patch = {};

  if (body?.sourceId !== undefined) {
    patch.sourceId = ensureSourceId(body.sourceId);
  }
  if (body?.name !== undefined) {
    patch.name = ensureCollectorName(body.name);
  }
  if (body?.provider !== undefined) {
    patch.provider = normalizeCollectorProvider(body.provider, 'match_snapshot');
  }
  if (body?.config !== undefined) {
    patch.config = normalizeConfigObject(body.config);
  }
  if (body?.scheduleCron !== undefined) {
    patch.scheduleCron = normalizeString(body.scheduleCron) || null;
  }
  if (body?.isEnabled !== undefined) {
    patch.isEnabled = !!body.isEnabled;
  }

  try {
    const beforeState = await getCollectorById({
      tenantId,
      collectorId: normalizedCollectorId,
    });
    if (!beforeState) {
      throw new StudioCatalogError('collector not found', 'COLLECTION_COLLECTOR_NOT_FOUND', 404);
    }

    const updated = await updateCollectorById({
      tenantId,
      collectorId: normalizedCollectorId,
      patch,
    });
    if (!updated) {
      throw new StudioCatalogError('collector not found', 'COLLECTION_COLLECTOR_NOT_FOUND', 404);
    }

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'datasource.collection.collector.update',
      targetType: 'datasource_collector',
      targetId: updated.id,
      beforeState,
      afterState: updated,
      metadata: {
        sourceId: updated.sourceId,
      },
    });

    return updated;
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      throw new StudioCatalogError(
        'collector already exists for source/name',
        'COLLECTION_COLLECTOR_CONFLICT',
        409,
      );
    }
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function resolveCollectorSampleRows({
  statuses,
  limit,
}) {
  if (!db.isConnected()) {
    throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
  }

  const params = [];
  let whereClause = 'WHERE 1=1';

  if (statuses.length > 0) {
    params.push(statuses);
    whereClause += ` AND m.status = ANY($${params.length}::text[])`;
  }

  params.push(limit);
  const limitPlaceholder = `$${params.length}`;

  const query = `
    SELECT m.*,
           row_to_json(ht.*) AS homeTeam,
           row_to_json(at.*) AS awayTeam
    FROM matches m
    LEFT JOIN teams ht ON m.home_team_id = ht.id
    LEFT JOIN teams at ON m.away_team_id = at.id
    ${whereClause}
    ORDER BY m.match_date DESC
    LIMIT ${limitPlaceholder}
  `;

  const result = await db.query(query, params);
  return Array.isArray(result?.rows)
    ? result.rows.map((row) => mapMatchRowToSnapshotRecord(row))
    : [];
}

async function triggerDatasourceCollectorRunForAdmin({ collectorId, body, authContext }) {
  const normalizedCollectorId = ensureCollectorId(collectorId);
  const tenantId = resolveTenantId(authContext, body?.tenantId);
  const triggerType = normalizeTriggerType(body?.triggerType, 'manual');
  const requestedByUserId = resolveActorUserId(authContext);

  let createdRun = null;

  try {
    const collector = await getCollectorById({
      tenantId,
      collectorId: normalizedCollectorId,
    });
    if (!collector) {
      throw new StudioCatalogError('collector not found', 'COLLECTION_COLLECTOR_NOT_FOUND', 404);
    }

    if (!collector.isEnabled && body?.force !== true) {
      throw new StudioCatalogError(
        'collector is disabled, set force=true to trigger manually',
        'COLLECTION_COLLECTOR_DISABLED',
        409,
      );
    }

    const collectorConfig = isPlainObject(collector.config) ? collector.config : {};
    const statuses = normalizeStatusList(
      body?.statuses !== undefined ? body.statuses : collectorConfig.statuses,
    );
    const limit = normalizeSampleLimit(
      body?.limit !== undefined ? body.limit : collectorConfig.sampleLimit,
      20,
    );
    const startedAt = new Date();

    createdRun = await createCollectionRun({
      tenantId,
      collectorId: collector.id,
      sourceId: collector.sourceId,
      triggerType,
      status: 'running',
      requestPayload: {
        statuses,
        limit,
        triggerType,
      },
      resultSummary: {},
      errorMessage: null,
      requestedByUserId,
      startedAt,
      finishedAt: null,
    });

    await updateCollectorById({
      tenantId,
      collectorId: collector.id,
      patch: {
        lastRunAt: startedAt,
        lastRunStatus: 'running',
      },
    });

    const sampledRows = await resolveCollectorSampleRows({
      statuses,
      limit,
    });
    const payload = {
      source: 'matches',
      sampledAt: new Date().toISOString(),
      filters: {
        statuses,
        limit,
      },
      rows: sampledRows,
    };
    const snapshot = await createCollectionSnapshot({
      tenantId,
      collectorId: collector.id,
      runId: createdRun.id,
      sourceId: collector.sourceId,
      payload,
      recordCount: sampledRows.length,
      contentHash: checksumPayload(payload),
      confirmationStatus: 'pending',
      releaseStatus: 'draft',
    });

    const finishedAt = new Date();
    const finishedRun = await updateCollectionRunById({
      runId: createdRun.id,
      patch: {
        status: 'succeeded',
        resultSummary: {
          rowCount: sampledRows.length,
          snapshotId: snapshot.id,
        },
        finishedAt,
      },
    });

    await updateCollectorById({
      tenantId,
      collectorId: collector.id,
      patch: {
        lastRunAt: finishedAt,
        lastRunStatus: 'succeeded',
      },
    });

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'datasource.collection.run',
      targetType: 'datasource_collector',
      targetId: collector.id,
      beforeState: null,
      afterState: {
        runId: finishedRun?.id || createdRun.id,
        snapshotId: snapshot.id,
        status: 'succeeded',
      },
      metadata: {
        sourceId: collector.sourceId,
        rowCount: sampledRows.length,
      },
    });

    return {
      collector,
      run: finishedRun || createdRun,
      snapshot,
    };
  } catch (error) {
    if (createdRun?.id) {
      try {
        await updateCollectionRunById({
          runId: createdRun.id,
          patch: {
            status: 'failed',
            errorMessage: normalizeString(error?.message) || 'collection run failed',
            finishedAt: new Date(),
          },
        });
      } catch {
        // ignore secondary failure
      }
    }

    try {
      const collector = await getCollectorById({
        tenantId,
        collectorId: normalizedCollectorId,
      });
      if (collector) {
        await updateCollectorById({
          tenantId,
          collectorId: collector.id,
          patch: {
            lastRunAt: new Date(),
            lastRunStatus: 'failed',
          },
        });
      }
    } catch {
      // ignore secondary failure
    }

    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function importDatasourceCollectionSnapshotForAdmin({ collectorId, body, authContext }) {
  const normalizedCollectorId = ensureCollectorId(collectorId);
  const tenantId = resolveTenantId(authContext, body?.tenantId);
  const triggerType = normalizeTriggerType(body?.triggerType, 'manual');
  const payload = normalizePayloadObject(body?.payload);
  const explicitContentHash = normalizeContentHashInput(body?.contentHash);
  const requestedByUserId = resolveActorUserId(authContext);
  const allowDuplicate = parseBooleanBodyInput(body?.allowDuplicate, false);
  const forceImport = parseBooleanBodyInput(body?.force, false);

  try {
    const collector = await getCollectorById({
      tenantId,
      collectorId: normalizedCollectorId,
    });
    if (!collector) {
      throw new StudioCatalogError('collector not found', 'COLLECTION_COLLECTOR_NOT_FOUND', 404);
    }
    if (!collector.isEnabled && !forceImport) {
      throw new StudioCatalogError(
        'collector is disabled, set force=true to import manually',
        'COLLECTION_COLLECTOR_DISABLED',
        409,
      );
    }

    const bodySourceId = normalizeString(body?.sourceId);
    if (bodySourceId && bodySourceId !== collector.sourceId) {
      throw new StudioCatalogError(
        'sourceId does not match collector.sourceId',
        'COLLECTION_SOURCE_ID_MISMATCH',
        400,
      );
    }

    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const explicitRecordCount = Number.parseInt(body?.recordCount, 10);
    const recordCount = Number.isFinite(explicitRecordCount)
      ? Math.max(0, explicitRecordCount)
      : rows.length;
    const contentHash = explicitContentHash || checksumPayload(payload);
    const payloadBytes = estimatePayloadBytes(payload);
    if (recordCount > MAX_IMPORT_RECORD_COUNT) {
      throw new StudioCatalogError(
        `recordCount exceeds max limit (${MAX_IMPORT_RECORD_COUNT})`,
        'COLLECTION_IMPORT_RECORD_COUNT_EXCEEDED',
        400,
      );
    }
    if (payloadBytes > MAX_IMPORT_PAYLOAD_BYTES) {
      throw new StudioCatalogError(
        `payload exceeds max bytes limit (${MAX_IMPORT_PAYLOAD_BYTES})`,
        'COLLECTION_IMPORT_PAYLOAD_TOO_LARGE',
        413,
      );
    }

    const startedAt = new Date();

    if (!allowDuplicate) {
      const duplicatedSnapshot = await findLatestSnapshotByContentHash({
        tenantId,
        sourceId: collector.sourceId,
        contentHash,
      });
      if (duplicatedSnapshot) {
        const dedupeRun = await createCollectionRun({
          tenantId,
          collectorId: collector.id,
          sourceId: collector.sourceId,
          triggerType,
          status: 'succeeded',
          requestPayload: {
            import: true,
            triggerType,
            recordCount,
            allowDuplicate: false,
            deduplicated: true,
            deduplicatedFromSnapshotId: duplicatedSnapshot.id,
            contentHash,
          },
          resultSummary: {
            imported: false,
            deduplicated: true,
            rowCount: recordCount,
            snapshotId: duplicatedSnapshot.id,
          },
          errorMessage: null,
          requestedByUserId,
          startedAt,
          finishedAt: startedAt,
        });

        await updateCollectorById({
          tenantId,
          collectorId: collector.id,
          patch: {
            lastRunAt: startedAt,
            lastRunStatus: 'succeeded',
          },
        });

        await writeAuditEvent({
          authContext,
          tenantId,
          action: 'datasource.collection.import',
          targetType: 'datasource_collector',
          targetId: collector.id,
          beforeState: null,
          afterState: {
            runId: dedupeRun?.id,
            snapshotId: duplicatedSnapshot.id,
            recordCount,
            deduplicated: true,
          },
          metadata: {
            sourceId: collector.sourceId,
            contentHash,
            deduplicatedFromSnapshotId: duplicatedSnapshot.id,
          },
        });

        return {
          collector,
          run: dedupeRun,
          snapshot: duplicatedSnapshot,
          deduplicated: true,
        };
      }
    }

    const run = await createCollectionRun({
      tenantId,
      collectorId: collector.id,
      sourceId: collector.sourceId,
      triggerType,
      status: 'succeeded',
      requestPayload: {
        import: true,
        triggerType,
        recordCount,
        allowDuplicate,
        contentHash,
      },
      resultSummary: {},
      errorMessage: null,
      requestedByUserId,
      startedAt,
      finishedAt: startedAt,
    });

    const snapshot = await createCollectionSnapshot({
      tenantId,
      collectorId: collector.id,
      runId: run.id,
      sourceId: collector.sourceId,
      payload,
      recordCount,
      contentHash,
      confirmationStatus: 'pending',
      releaseStatus: 'draft',
    });

    const finishedRun = await updateCollectionRunById({
      runId: run.id,
      patch: {
        resultSummary: {
          imported: true,
          deduplicated: false,
          rowCount: recordCount,
          snapshotId: snapshot.id,
        },
      },
    });

    await updateCollectorById({
      tenantId,
      collectorId: collector.id,
      patch: {
        lastRunAt: startedAt,
        lastRunStatus: 'succeeded',
      },
    });

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'datasource.collection.import',
      targetType: 'datasource_collector',
      targetId: collector.id,
      beforeState: null,
      afterState: {
        runId: finishedRun?.id || run.id,
        snapshotId: snapshot.id,
        recordCount,
        deduplicated: false,
      },
      metadata: {
        sourceId: collector.sourceId,
        contentHash,
        payloadBytes,
      },
    });

    return {
      collector,
      run: finishedRun || run,
      snapshot,
      deduplicated: false,
    };
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function listDatasourceCollectionRunsForAdmin({ query, authContext }) {
  try {
    const tenantId = resolveTenantId(authContext, query?.tenantId);
    const status = ensureAllowedStatus(
      query?.status,
      ALLOWED_RUN_STATUSES,
      'COLLECTION_RUN_STATUS',
      'run status',
    );
    const triggerType = ensureAllowedStatus(
      query?.triggerType,
      ALLOWED_TRIGGER_TYPES,
      'COLLECTION_TRIGGER_TYPE',
      'triggerType',
    );

    return await listCollectionRuns({
      tenantId,
      collectorId: query?.collectorId,
      sourceId: query?.sourceId,
      status: status || undefined,
      triggerType: triggerType || undefined,
      limit: query?.limit,
      offset: query?.offset,
    });
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function listDatasourceCollectionSnapshotsForAdmin({ query, authContext }) {
  try {
    const tenantId = resolveTenantId(authContext, query?.tenantId);
    const confirmationStatus = ensureAllowedStatus(
      query?.confirmationStatus,
      ALLOWED_CONFIRMATION_STATUSES,
      'COLLECTION_CONFIRMATION_STATUS',
      'confirmation status',
    );
    const releaseStatus = ensureAllowedStatus(
      query?.releaseStatus,
      ALLOWED_RELEASE_STATUSES,
      'COLLECTION_RELEASE_STATUS',
      'release status',
    );
    const releaseChannel = ensureAllowedStatus(
      query?.releaseChannel,
      ALLOWED_RELEASE_CHANNELS,
      'COLLECTION_RELEASE_CHANNEL',
      'release channel',
    );

    return await listCollectionSnapshots({
      tenantId,
      collectorId: query?.collectorId,
      sourceId: query?.sourceId,
      confirmationStatus: confirmationStatus || undefined,
      releaseStatus: releaseStatus || undefined,
      releaseChannel: releaseChannel || undefined,
      limit: query?.limit,
      offset: query?.offset,
    });
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function listDatasourceCollectionHealthForAdmin({ query, authContext }) {
  try {
    const tenantId = resolveTenantId(authContext, query?.tenantId);
    const includeDisabled = parseBooleanInput(query?.includeDisabled) === true;
    const limit = normalizeSampleLimit(query?.limit, 50);
    const offset = Math.max(0, normalizePositiveInteger(query?.offset, 0, 0, 100000));
    const staleAfterMinutes = normalizePositiveInteger(
      query?.staleAfterMinutes,
      DEFAULT_COLLECTION_SLA_MAX_LAG_MINUTES,
      5,
      7 * 24 * 60,
    );

    const collectorsResult = await listCollectors({
      tenantId,
      sourceId: query?.sourceId,
      isEnabled: includeDisabled ? undefined : true,
      limit,
      offset,
    });
    const collectors = Array.isArray(collectorsResult?.data) ? collectorsResult.data : [];

    const data = await Promise.all(
      collectors.map(async (collector) => {
        const latestRunResult = await listCollectionRuns({
          tenantId,
          collectorId: collector.id,
          limit: 1,
          offset: 0,
        });
        const latestRun =
          Array.isArray(latestRunResult?.data) && latestRunResult.data.length > 0
            ? latestRunResult.data[0]
            : null;
        const health = resolveCollectorHealth(
          collector,
          latestRun,
          Date.now(),
          staleAfterMinutes,
        );
        return {
          collector,
          latestRun,
          health,
        };
      }),
    );

    const summary = data.reduce(
      (accumulator, item) => {
        const status = item.health.status;
        if (status === 'healthy') accumulator.healthy += 1;
        if (status === 'stale') accumulator.stale += 1;
        if (status === 'failed') accumulator.failed += 1;
        if (status === 'never_run') accumulator.neverRun += 1;
        if (status === 'disabled') accumulator.disabled += 1;
        return accumulator;
      },
      {
        total: data.length,
        healthy: 0,
        stale: 0,
        failed: 0,
        neverRun: 0,
        disabled: 0,
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      staleAfterMinutes,
      summary,
      data,
      pagination: collectorsResult?.pagination || {
        limit,
        offset,
        count: data.length,
      },
    };
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function confirmDatasourceCollectionSnapshotForAdmin({ snapshotId, body, authContext }) {
  const normalizedSnapshotId = ensureSnapshotId(snapshotId);
  const tenantId = resolveTenantId(authContext, body?.tenantId);
  const actionInput = normalizeString(body?.action) || 'confirm';
  if (actionInput !== 'confirm' && actionInput !== 'reject') {
    throw new StudioCatalogError(
      'action must be confirm or reject',
      'COLLECTION_CONFIRM_ACTION_INVALID',
      400,
    );
  }
  const confirmationNotes = normalizeString(body?.notes) || null;

  try {
    const beforeState = await getCollectionSnapshotById({
      tenantId,
      snapshotId: normalizedSnapshotId,
    });
    if (!beforeState) {
      throw new StudioCatalogError('snapshot not found', 'COLLECTION_SNAPSHOT_NOT_FOUND', 404);
    }

    if (beforeState.releaseStatus === 'released' && actionInput === 'reject') {
      throw new StudioCatalogError(
        'released snapshot cannot be rejected',
        'COLLECTION_SNAPSHOT_ALREADY_RELEASED',
        409,
      );
    }

    const now = new Date();
    const updated = await updateCollectionSnapshotById({
      tenantId,
      snapshotId: normalizedSnapshotId,
      patch: {
        confirmationStatus: actionInput === 'confirm' ? 'confirmed' : 'rejected',
        confirmationNotes,
        confirmedByUserId: resolveActorUserId(authContext),
        confirmedAt: now,
        ...(actionInput === 'reject'
          ? {
            releaseStatus: 'draft',
            releaseChannel: null,
            releasedByUserId: null,
            releasedAt: null,
          }
          : {}),
      },
    });
    if (!updated) {
      throw new StudioCatalogError('snapshot not found', 'COLLECTION_SNAPSHOT_NOT_FOUND', 404);
    }

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'datasource.collection.snapshot.confirm',
      targetType: 'datasource_snapshot',
      targetId: updated.id,
      beforeState,
      afterState: updated,
      metadata: {
        action: actionInput,
      },
    });

    return updated;
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function releaseDatasourceCollectionSnapshotForAdmin({ snapshotId, body, authContext }) {
  const normalizedSnapshotId = ensureSnapshotId(snapshotId);
  const tenantId = resolveTenantId(authContext, body?.tenantId);
  const releaseChannel = normalizeReleaseChannel(body?.channel, 'internal');

  try {
    const beforeState = await getCollectionSnapshotById({
      tenantId,
      snapshotId: normalizedSnapshotId,
    });
    if (!beforeState) {
      throw new StudioCatalogError('snapshot not found', 'COLLECTION_SNAPSHOT_NOT_FOUND', 404);
    }
    if (beforeState.confirmationStatus !== 'confirmed') {
      throw new StudioCatalogError(
        'snapshot must be confirmed before release',
        'COLLECTION_RELEASE_BLOCKED_BY_CONFIRMATION',
        409,
      );
    }

    const releasedAt = new Date();
    const releasedByUserId = resolveActorUserId(authContext);
    const releaseResult = await releaseSnapshotAndDeprecatePrevious({
      tenantId,
      snapshotId: normalizedSnapshotId,
      sourceId: beforeState.sourceId,
      releaseChannel,
      releasedByUserId,
      releasedAt,
    });
    if (!releaseResult?.snapshot) {
      const latestSnapshot = await getCollectionSnapshotById({
        tenantId,
        snapshotId: normalizedSnapshotId,
      });
      if (!latestSnapshot) {
        throw new StudioCatalogError('snapshot not found', 'COLLECTION_SNAPSHOT_NOT_FOUND', 404);
      }
      if (latestSnapshot.confirmationStatus !== 'confirmed') {
        throw new StudioCatalogError(
          'snapshot must be confirmed before release',
          'COLLECTION_RELEASE_BLOCKED_BY_CONFIRMATION',
          409,
        );
      }
      throw new StudioCatalogError(
        'snapshot release conflicted with concurrent update, retry',
        'COLLECTION_RELEASE_CONFLICT',
        409,
      );
    }

    const updated = releaseResult.snapshot;
    const deprecatedSnapshotIds = Array.isArray(releaseResult.deprecatedSnapshotIds)
      ? releaseResult.deprecatedSnapshotIds
      : [];

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'datasource.collection.snapshot.release',
      targetType: 'datasource_snapshot',
      targetId: updated.id,
      beforeState,
      afterState: updated,
      metadata: {
        channel: releaseChannel,
        deprecatedSnapshotCount: deprecatedSnapshotIds.length,
      },
    });

    return {
      snapshot: updated,
      deprecatedSnapshotIds: deprecatedSnapshotIds
        .filter((id) => id !== updated.id),
    };
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function replayDatasourceCollectionSnapshotForAdmin({ snapshotId, body, authContext }) {
  const normalizedSnapshotId = ensureSnapshotId(snapshotId);
  const tenantId = resolveTenantId(authContext, body?.tenantId);

  try {
    const sourceSnapshot = await getCollectionSnapshotById({
      tenantId,
      snapshotId: normalizedSnapshotId,
    });
    if (!sourceSnapshot) {
      throw new StudioCatalogError('snapshot not found', 'COLLECTION_SNAPSHOT_NOT_FOUND', 404);
    }

    const replayResult = await importDatasourceCollectionSnapshotForAdmin({
      collectorId: sourceSnapshot.collectorId,
      body: {
        tenantId,
        triggerType: body?.triggerType || 'retry',
        sourceId: sourceSnapshot.sourceId,
        payload: sourceSnapshot.payload,
        recordCount: sourceSnapshot.recordCount,
        contentHash: sourceSnapshot.contentHash || undefined,
        allowDuplicate: body?.allowDuplicate,
        force: body?.force,
      },
      authContext,
    });

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'datasource.collection.snapshot.replay',
      targetType: 'datasource_snapshot',
      targetId: sourceSnapshot.id,
      beforeState: sourceSnapshot,
      afterState: {
        replayRunId: replayResult?.run?.id || null,
        replaySnapshotId: replayResult?.snapshot?.id || null,
        deduplicated: replayResult?.deduplicated === true,
      },
      metadata: {
        collectorId: sourceSnapshot.collectorId,
        sourceId: sourceSnapshot.sourceId,
      },
    });

    return {
      sourceSnapshotId: sourceSnapshot.id,
      ...replayResult,
    };
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

module.exports = {
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
};
