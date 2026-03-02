const db = require('../../db');

function ensureDbConnected() {
  if (!db.isConnected()) {
    throw new Error('Database not connected');
  }
}

function toInt(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function mapCollectorRow(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sourceId: row.source_id,
    name: row.name,
    provider: row.provider,
    config: row.config_json || {},
    scheduleCron: row.schedule_cron,
    isEnabled: !!row.is_enabled,
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRunRow(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    collectorId: row.collector_id,
    sourceId: row.source_id,
    triggerType: row.trigger_type,
    status: row.status,
    requestPayload: row.request_payload_json || {},
    resultSummary: row.result_summary_json || {},
    errorMessage: row.error_message,
    requestedByUserId: row.requested_by_user_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSnapshotRow(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    collectorId: row.collector_id,
    runId: row.run_id,
    sourceId: row.source_id,
    payload: row.payload_json || {},
    recordCount: row.record_count,
    contentHash: row.content_hash,
    confirmationStatus: row.confirmation_status,
    confirmationNotes: row.confirmation_notes,
    confirmedByUserId: row.confirmed_by_user_id,
    confirmedAt: row.confirmed_at,
    releaseStatus: row.release_status,
    releaseChannel: row.release_channel,
    releasedByUserId: row.released_by_user_id,
    releasedAt: row.released_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listCollectors({
  tenantId,
  sourceId,
  isEnabled,
  limit,
  offset,
}) {
  ensureDbConnected();
  const normalizedLimit = Math.max(1, Math.min(toInt(limit, 50), 200));
  const normalizedOffset = Math.max(0, toInt(offset, 0));
  const params = [tenantId];
  let whereClause = 'WHERE tenant_id = $1';

  if (typeof sourceId === 'string' && sourceId.trim().length > 0) {
    params.push(sourceId.trim());
    whereClause += ` AND source_id = $${params.length}`;
  }

  if (isEnabled !== undefined) {
    params.push(!!isEnabled);
    whereClause += ` AND is_enabled = $${params.length}`;
  }

  const query = `
    SELECT *
    FROM datasource_collectors
    ${whereClause}
    ORDER BY updated_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
  params.push(normalizedLimit);
  params.push(normalizedOffset);

  const result = await db.query(query, params);
  return {
    data: result.rows.map(mapCollectorRow),
    pagination: {
      limit: normalizedLimit,
      offset: normalizedOffset,
      count: result.rows.length,
    },
  };
}

async function createCollector({
  tenantId,
  sourceId,
  name,
  provider,
  config,
  scheduleCron,
  isEnabled,
  createdByUserId,
}) {
  ensureDbConnected();
  const result = await db.query(
    `
      INSERT INTO datasource_collectors (
        tenant_id,
        source_id,
        name,
        provider,
        config_json,
        schedule_cron,
        is_enabled,
        created_by_user_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,
    [
      tenantId,
      sourceId,
      name,
      provider,
      config || {},
      scheduleCron || null,
      isEnabled !== false,
      createdByUserId || null,
    ],
  );
  return mapCollectorRow(result.rows[0]);
}

async function getCollectorById({ tenantId, collectorId }) {
  ensureDbConnected();
  const result = await db.query(
    `
      SELECT *
      FROM datasource_collectors
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
    `,
    [tenantId, collectorId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapCollectorRow(result.rows[0]);
}

async function updateCollectorById({ tenantId, collectorId, patch }) {
  ensureDbConnected();
  const params = [tenantId, collectorId];
  const updates = [];

  if (patch.sourceId !== undefined) {
    params.push(patch.sourceId);
    updates.push(`source_id = $${params.length}`);
  }
  if (patch.name !== undefined) {
    params.push(patch.name);
    updates.push(`name = $${params.length}`);
  }
  if (patch.provider !== undefined) {
    params.push(patch.provider);
    updates.push(`provider = $${params.length}`);
  }
  if (patch.config !== undefined) {
    params.push(patch.config || {});
    updates.push(`config_json = $${params.length}`);
  }
  if (patch.scheduleCron !== undefined) {
    params.push(patch.scheduleCron || null);
    updates.push(`schedule_cron = $${params.length}`);
  }
  if (patch.isEnabled !== undefined) {
    params.push(!!patch.isEnabled);
    updates.push(`is_enabled = $${params.length}`);
  }
  if (patch.lastRunAt !== undefined) {
    params.push(patch.lastRunAt || null);
    updates.push(`last_run_at = $${params.length}`);
  }
  if (patch.lastRunStatus !== undefined) {
    params.push(patch.lastRunStatus);
    updates.push(`last_run_status = $${params.length}`);
  }

  if (updates.length === 0) {
    return getCollectorById({ tenantId, collectorId });
  }

  const query = `
    UPDATE datasource_collectors
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;
  const result = await db.query(query, params);
  if (result.rows.length === 0) {
    return null;
  }
  return mapCollectorRow(result.rows[0]);
}

async function listCollectionRuns({
  tenantId,
  collectorId,
  sourceId,
  status,
  triggerType,
  limit,
  offset,
}) {
  ensureDbConnected();
  const normalizedLimit = Math.max(1, Math.min(toInt(limit, 50), 200));
  const normalizedOffset = Math.max(0, toInt(offset, 0));
  const params = [tenantId];
  let whereClause = 'WHERE tenant_id = $1';

  if (typeof collectorId === 'string' && collectorId.trim().length > 0) {
    params.push(collectorId.trim());
    whereClause += ` AND collector_id = $${params.length}`;
  }
  if (typeof sourceId === 'string' && sourceId.trim().length > 0) {
    params.push(sourceId.trim());
    whereClause += ` AND source_id = $${params.length}`;
  }
  if (typeof status === 'string' && status.trim().length > 0) {
    params.push(status.trim());
    whereClause += ` AND status = $${params.length}`;
  }
  if (typeof triggerType === 'string' && triggerType.trim().length > 0) {
    params.push(triggerType.trim());
    whereClause += ` AND trigger_type = $${params.length}`;
  }

  const query = `
    SELECT *
    FROM datasource_collection_runs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
  params.push(normalizedLimit);
  params.push(normalizedOffset);

  const result = await db.query(query, params);
  return {
    data: result.rows.map(mapRunRow),
    pagination: {
      limit: normalizedLimit,
      offset: normalizedOffset,
      count: result.rows.length,
    },
  };
}

async function createCollectionRun({
  tenantId,
  collectorId,
  sourceId,
  triggerType,
  status,
  requestPayload,
  resultSummary,
  errorMessage,
  requestedByUserId,
  startedAt,
  finishedAt,
}) {
  ensureDbConnected();
  const result = await db.query(
    `
      INSERT INTO datasource_collection_runs (
        tenant_id,
        collector_id,
        source_id,
        trigger_type,
        status,
        request_payload_json,
        result_summary_json,
        error_message,
        requested_by_user_id,
        started_at,
        finished_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `,
    [
      tenantId,
      collectorId,
      sourceId,
      triggerType,
      status,
      requestPayload || {},
      resultSummary || {},
      errorMessage || null,
      requestedByUserId || null,
      startedAt || null,
      finishedAt || null,
    ],
  );
  return mapRunRow(result.rows[0]);
}

async function updateCollectionRunById({ runId, patch }) {
  ensureDbConnected();
  const params = [runId];
  const updates = [];

  if (patch.status !== undefined) {
    params.push(patch.status);
    updates.push(`status = $${params.length}`);
  }
  if (patch.requestPayload !== undefined) {
    params.push(patch.requestPayload || {});
    updates.push(`request_payload_json = $${params.length}`);
  }
  if (patch.resultSummary !== undefined) {
    params.push(patch.resultSummary || {});
    updates.push(`result_summary_json = $${params.length}`);
  }
  if (patch.errorMessage !== undefined) {
    params.push(patch.errorMessage || null);
    updates.push(`error_message = $${params.length}`);
  }
  if (patch.startedAt !== undefined) {
    params.push(patch.startedAt || null);
    updates.push(`started_at = $${params.length}`);
  }
  if (patch.finishedAt !== undefined) {
    params.push(patch.finishedAt || null);
    updates.push(`finished_at = $${params.length}`);
  }

  if (updates.length === 0) {
    return null;
  }

  const result = await db.query(
    `
      UPDATE datasource_collection_runs
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    params,
  );

  if (result.rows.length === 0) {
    return null;
  }
  return mapRunRow(result.rows[0]);
}

async function listCollectionSnapshots({
  tenantId,
  collectorId,
  sourceId,
  confirmationStatus,
  releaseStatus,
  releaseChannel,
  limit,
  offset,
}) {
  ensureDbConnected();
  const normalizedLimit = Math.max(1, Math.min(toInt(limit, 50), 200));
  const normalizedOffset = Math.max(0, toInt(offset, 0));
  const params = [tenantId];
  let whereClause = 'WHERE tenant_id = $1';

  if (typeof collectorId === 'string' && collectorId.trim().length > 0) {
    params.push(collectorId.trim());
    whereClause += ` AND collector_id = $${params.length}`;
  }
  if (typeof sourceId === 'string' && sourceId.trim().length > 0) {
    params.push(sourceId.trim());
    whereClause += ` AND source_id = $${params.length}`;
  }
  if (typeof confirmationStatus === 'string' && confirmationStatus.trim().length > 0) {
    params.push(confirmationStatus.trim());
    whereClause += ` AND confirmation_status = $${params.length}`;
  }
  if (typeof releaseStatus === 'string' && releaseStatus.trim().length > 0) {
    params.push(releaseStatus.trim());
    whereClause += ` AND release_status = $${params.length}`;
  }
  if (typeof releaseChannel === 'string' && releaseChannel.trim().length > 0) {
    params.push(releaseChannel.trim());
    whereClause += ` AND release_channel = $${params.length}`;
  }

  const query = `
    SELECT *
    FROM datasource_collection_snapshots
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
  params.push(normalizedLimit);
  params.push(normalizedOffset);

  const result = await db.query(query, params);
  return {
    data: result.rows.map(mapSnapshotRow),
    pagination: {
      limit: normalizedLimit,
      offset: normalizedOffset,
      count: result.rows.length,
    },
  };
}

async function createCollectionSnapshot({
  tenantId,
  collectorId,
  runId,
  sourceId,
  payload,
  recordCount,
  contentHash,
  confirmationStatus,
  releaseStatus,
}) {
  ensureDbConnected();
  const result = await db.query(
    `
      INSERT INTO datasource_collection_snapshots (
        tenant_id,
        collector_id,
        run_id,
        source_id,
        payload_json,
        record_count,
        content_hash,
        confirmation_status,
        release_status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `,
    [
      tenantId,
      collectorId,
      runId || null,
      sourceId,
      payload || {},
      Number.isFinite(recordCount) ? recordCount : 0,
      contentHash || null,
      confirmationStatus || 'pending',
      releaseStatus || 'draft',
    ],
  );
  return mapSnapshotRow(result.rows[0]);
}

async function findLatestSnapshotByContentHash({
  tenantId,
  sourceId,
  contentHash,
}) {
  ensureDbConnected();
  if (typeof contentHash !== 'string' || contentHash.trim().length === 0) {
    return null;
  }
  const result = await db.query(
    `
      SELECT *
      FROM datasource_collection_snapshots
      WHERE tenant_id = $1
        AND source_id = $2
        AND content_hash = $3
        AND confirmation_status <> 'rejected'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, sourceId, contentHash],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapSnapshotRow(result.rows[0]);
}

async function getCollectionSnapshotById({ tenantId, snapshotId }) {
  ensureDbConnected();
  const result = await db.query(
    `
      SELECT *
      FROM datasource_collection_snapshots
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
    `,
    [tenantId, snapshotId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapSnapshotRow(result.rows[0]);
}

async function updateCollectionSnapshotById({ tenantId, snapshotId, patch }) {
  ensureDbConnected();
  const params = [tenantId, snapshotId];
  const updates = [];

  if (patch.payload !== undefined) {
    params.push(patch.payload || {});
    updates.push(`payload_json = $${params.length}`);
  }
  if (patch.recordCount !== undefined) {
    params.push(patch.recordCount);
    updates.push(`record_count = $${params.length}`);
  }
  if (patch.contentHash !== undefined) {
    params.push(patch.contentHash || null);
    updates.push(`content_hash = $${params.length}`);
  }
  if (patch.confirmationStatus !== undefined) {
    params.push(patch.confirmationStatus);
    updates.push(`confirmation_status = $${params.length}`);
  }
  if (patch.confirmationNotes !== undefined) {
    params.push(patch.confirmationNotes || null);
    updates.push(`confirmation_notes = $${params.length}`);
  }
  if (patch.confirmedByUserId !== undefined) {
    params.push(patch.confirmedByUserId || null);
    updates.push(`confirmed_by_user_id = $${params.length}`);
  }
  if (patch.confirmedAt !== undefined) {
    params.push(patch.confirmedAt || null);
    updates.push(`confirmed_at = $${params.length}`);
  }
  if (patch.releaseStatus !== undefined) {
    params.push(patch.releaseStatus);
    updates.push(`release_status = $${params.length}`);
  }
  if (patch.releaseChannel !== undefined) {
    params.push(patch.releaseChannel || null);
    updates.push(`release_channel = $${params.length}`);
  }
  if (patch.releasedByUserId !== undefined) {
    params.push(patch.releasedByUserId || null);
    updates.push(`released_by_user_id = $${params.length}`);
  }
  if (patch.releasedAt !== undefined) {
    params.push(patch.releasedAt || null);
    updates.push(`released_at = $${params.length}`);
  }

  if (updates.length === 0) {
    return getCollectionSnapshotById({ tenantId, snapshotId });
  }

  const result = await db.query(
    `
      UPDATE datasource_collection_snapshots
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING *
    `,
    params,
  );

  if (result.rows.length === 0) {
    return null;
  }
  return mapSnapshotRow(result.rows[0]);
}

async function markReleasedSnapshotsDeprecated({
  tenantId,
  sourceId,
  releaseChannel,
}) {
  ensureDbConnected();
  const result = await db.query(
    `
      UPDATE datasource_collection_snapshots
      SET release_status = 'deprecated', updated_at = NOW()
      WHERE tenant_id = $1
        AND source_id = $2
        AND release_status = 'released'
        AND release_channel = $3
      RETURNING *
    `,
    [tenantId, sourceId, releaseChannel],
  );
  return result.rows.map(mapSnapshotRow);
}

async function releaseSnapshotAndDeprecatePrevious({
  tenantId,
  snapshotId,
  sourceId,
  releaseChannel,
  releasedByUserId,
  releasedAt,
}) {
  ensureDbConnected();
  const result = await db.query(
    `
      WITH target AS (
        UPDATE datasource_collection_snapshots
        SET release_status = 'released',
            release_channel = $4,
            released_by_user_id = $5,
            released_at = $6,
            updated_at = NOW()
        WHERE tenant_id = $1
          AND id = $2
          AND confirmation_status = 'confirmed'
        RETURNING *
      ),
      deprecated AS (
        UPDATE datasource_collection_snapshots
        SET release_status = 'deprecated',
            updated_at = NOW()
        WHERE tenant_id = $1
          AND source_id = $3
          AND release_status = 'released'
          AND release_channel = $4
          AND id <> $2
        RETURNING id
      )
      SELECT
        (SELECT row_to_json(target.*) FROM target) AS target_snapshot,
        COALESCE((SELECT json_agg(deprecated.id) FROM deprecated), '[]'::json) AS deprecated_ids
    `,
    [tenantId, snapshotId, sourceId, releaseChannel, releasedByUserId || null, releasedAt || null],
  );

  const row = result.rows[0];
  if (!row?.target_snapshot) {
    return null;
  }

  const deprecatedIds = Array.isArray(row.deprecated_ids)
    ? row.deprecated_ids
    : [];

  return {
    snapshot: mapSnapshotRow(row.target_snapshot),
    deprecatedSnapshotIds: deprecatedIds,
  };
}

module.exports = {
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
  markReleasedSnapshotsDeprecated,
  releaseSnapshotAndDeprecatePrevious,
};
