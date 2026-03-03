const db = require('../../db');

const DOMAIN_CONFIG = {
  datasource: {
    table: 'datasource_revisions',
    editPermission: 'catalog:datasource:edit',
  },
  planning_template: {
    table: 'planning_template_revisions',
    editPermission: 'catalog:template:edit',
  },
  animation_template: {
    table: 'animation_template_revisions',
    editPermission: 'catalog:animation:edit',
  },
  agent: {
    table: 'agent_revisions',
    editPermission: 'catalog:agent:edit',
  },
  skill: {
    table: 'skill_revisions',
    editPermission: 'catalog:skill:edit',
  },
  domain_pack: {
    table: 'domain_pack_revisions',
    editPermission: 'catalog:domain:edit',
  },
};

function ensureDbConnected() {
  if (!db.isConnected()) {
    throw new Error('Database not connected');
  }
}

function toInt(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function normalizeDomain(domainInput) {
  const domain = String(domainInput || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DOMAIN_CONFIG, domain) ? domain : null;
}

function getDomainConfig(domainInput) {
  const domain = normalizeDomain(domainInput);
  if (!domain) {
    return null;
  }
  return {
    domain,
    ...DOMAIN_CONFIG[domain],
  };
}

function mapCatalogEntryRow(domain, row) {
  return {
    domain,
    itemId: row.item_id,
    latestVersion: row.latest_version,
    latestStatus: row.latest_status,
    latestChannel: row.latest_channel,
    updatedAt: row.updated_at,
  };
}

function mapRevisionRow(domain, row) {
  return {
    id: row.id,
    domain,
    tenantId: row.tenant_id,
    itemId: row.item_id,
    version: row.version,
    status: row.status,
    channel: row.channel,
    manifest: row.manifest_json,
    checksum: row.checksum,
    validationSummary: row.validation_summary || {},
    createdByUserId: row.created_by_user_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapValidationRunRow(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    runType: row.run_type,
    domain: row.domain,
    scope: row.scope_json || {},
    status: row.status,
    logs: row.logs_json || [],
    result: row.result_json || {},
    triggeredByUserId: row.triggered_by_user_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReleaseRecordRow(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    domain: row.domain,
    itemId: row.item_id,
    action: row.action,
    channel: row.channel,
    fromVersion: row.from_version,
    toVersion: row.to_version,
    status: row.status,
    notes: row.notes,
    validationRunId: row.validation_run_id,
    triggeredByUserId: row.triggered_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listCatalogEntries({ domain, tenantId, status, search, limit, offset }) {
  ensureDbConnected();
  const config = getDomainConfig(domain);
  if (!config) {
    throw new Error('Invalid catalog domain');
  }

  const normalizedLimit = Math.max(1, Math.min(toInt(limit, 50), 200));
  const normalizedOffset = Math.max(0, toInt(offset, 0));
  const params = [tenantId];
  let whereClause = 'WHERE tenant_id = $1';

  if (typeof status === 'string' && status.trim().length > 0) {
    params.push(status.trim());
    whereClause += ` AND status = $${params.length}`;
  }
  if (typeof search === 'string' && search.trim().length > 0) {
    params.push(`%${search.trim()}%`);
    whereClause += ` AND item_id ILIKE $${params.length}`;
  }

  const query = `
    SELECT DISTINCT ON (item_id)
      item_id,
      version AS latest_version,
      status AS latest_status,
      channel AS latest_channel,
      updated_at
    FROM ${config.table}
    ${whereClause}
    ORDER BY item_id ASC, updated_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  params.push(normalizedLimit);
  params.push(normalizedOffset);
  const result = await db.query(query, params);
  return {
    data: result.rows.map((row) => mapCatalogEntryRow(config.domain, row)),
    pagination: {
      limit: normalizedLimit,
      offset: normalizedOffset,
      count: result.rows.length,
    },
  };
}

async function listCatalogRevisions({ domain, tenantId, itemId, status, channel, limit, offset }) {
  ensureDbConnected();
  const config = getDomainConfig(domain);
  if (!config) {
    throw new Error('Invalid catalog domain');
  }

  const normalizedLimit = Math.max(1, Math.min(toInt(limit, 50), 200));
  const normalizedOffset = Math.max(0, toInt(offset, 0));
  const params = [tenantId, itemId];
  let whereClause = 'WHERE tenant_id = $1 AND item_id = $2';

  if (typeof status === 'string' && status.trim().length > 0) {
    params.push(status.trim());
    whereClause += ` AND status = $${params.length}`;
  }
  if (typeof channel === 'string' && channel.trim().length > 0) {
    params.push(channel.trim());
    whereClause += ` AND channel = $${params.length}`;
  }

  const query = `
    SELECT *
    FROM ${config.table}
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  params.push(normalizedLimit);
  params.push(normalizedOffset);
  const result = await db.query(query, params);
  return {
    data: result.rows.map((row) => mapRevisionRow(config.domain, row)),
    pagination: {
      limit: normalizedLimit,
      offset: normalizedOffset,
      count: result.rows.length,
    },
  };
}

async function getCatalogRevisionByVersion({ domain, tenantId, itemId, version }) {
  ensureDbConnected();
  const config = getDomainConfig(domain);
  if (!config) {
    throw new Error('Invalid catalog domain');
  }

  const result = await db.query(
    `
      SELECT *
      FROM ${config.table}
      WHERE tenant_id = $1
        AND item_id = $2
        AND version = $3
      LIMIT 1
    `,
    [tenantId, itemId, version],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapRevisionRow(config.domain, result.rows[0]);
}

async function getLatestPublishedRevision({ domain, tenantId, itemId, channel }) {
  ensureDbConnected();
  const config = getDomainConfig(domain);
  if (!config) {
    throw new Error('Invalid catalog domain');
  }

  const result = await db.query(
    `
      SELECT *
      FROM ${config.table}
      WHERE tenant_id = $1
        AND item_id = $2
        AND status = 'published'
        AND channel = $3
      ORDER BY published_at DESC NULLS LAST, updated_at DESC
      LIMIT 1
    `,
    [tenantId, itemId, channel],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapRevisionRow(config.domain, result.rows[0]);
}

async function createCatalogRevision({
  domain,
  tenantId,
  itemId,
  version,
  status,
  channel,
  manifest,
  checksum,
  validationSummary,
  createdByUserId,
}) {
  ensureDbConnected();
  const config = getDomainConfig(domain);
  if (!config) {
    throw new Error('Invalid catalog domain');
  }

  const result = await db.query(
    `
      INSERT INTO ${config.table} (
        tenant_id,
        item_id,
        version,
        status,
        channel,
        manifest_json,
        checksum,
        validation_summary,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      tenantId,
      itemId,
      version,
      status,
      channel,
      JSON.stringify(manifest || {}),
      checksum || null,
      JSON.stringify(validationSummary || {}),
      createdByUserId || null,
    ],
  );
  return mapRevisionRow(config.domain, result.rows[0]);
}

async function updateCatalogRevisionByVersion({
  domain,
  tenantId,
  itemId,
  version,
  manifest,
  checksum,
  status,
  channel,
  publishedAt,
  validationSummary,
}) {
  ensureDbConnected();
  const config = getDomainConfig(domain);
  if (!config) {
    throw new Error('Invalid catalog domain');
  }

  const updates = [];
  const params = [];

  if (typeof status === 'string') {
    params.push(status);
    updates.push(`status = $${params.length}`);
  }
  if (typeof channel === 'string') {
    params.push(channel);
    updates.push(`channel = $${params.length}`);
  }
  if (publishedAt !== undefined) {
    params.push(publishedAt);
    updates.push(`published_at = $${params.length}`);
  }
  if (manifest !== undefined) {
    params.push(JSON.stringify(manifest || {}));
    updates.push(`manifest_json = $${params.length}`);
  }
  if (checksum !== undefined) {
    params.push(checksum || null);
    updates.push(`checksum = $${params.length}`);
  }
  if (validationSummary !== undefined) {
    params.push(JSON.stringify(validationSummary || {}));
    updates.push(`validation_summary = $${params.length}`);
  }

  if (updates.length === 0) {
    return getCatalogRevisionByVersion({ domain, tenantId, itemId, version });
  }

  params.push(tenantId);
  params.push(itemId);
  params.push(version);

  const result = await db.query(
    `
      UPDATE ${config.table}
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE tenant_id = $${params.length - 2}
        AND item_id = $${params.length - 1}
        AND version = $${params.length}
      RETURNING *
    `,
    params,
  );

  if (result.rows.length === 0) {
    return null;
  }
  return mapRevisionRow(config.domain, result.rows[0]);
}

async function markPublishedRevisionAsDeprecated({ domain, tenantId, itemId, channel }) {
  ensureDbConnected();
  const config = getDomainConfig(domain);
  if (!config) {
    throw new Error('Invalid catalog domain');
  }

  const result = await db.query(
    `
      UPDATE ${config.table}
      SET status = 'deprecated', updated_at = NOW()
      WHERE tenant_id = $1
        AND item_id = $2
        AND channel = $3
        AND status = 'published'
      RETURNING *
    `,
    [tenantId, itemId, channel],
  );
  return result.rows.map((row) => mapRevisionRow(config.domain, row));
}

async function createValidationRun({
  tenantId,
  runType,
  domain,
  scope,
  status,
  logs,
  result,
  triggeredByUserId,
  startedAt,
  finishedAt,
}) {
  ensureDbConnected();
  const query = `
    INSERT INTO validation_runs (
      tenant_id,
      run_type,
      domain,
      scope_json,
      status,
      logs_json,
      result_json,
      triggered_by_user_id,
      started_at,
      finished_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `;
  const values = [
    tenantId,
    runType,
    domain,
    JSON.stringify(scope || {}),
    status,
    JSON.stringify(logs || []),
    JSON.stringify(result || {}),
    triggeredByUserId || null,
    startedAt || null,
    finishedAt || null,
  ];
  const queryResult = await db.query(query, values);
  return mapValidationRunRow(queryResult.rows[0]);
}

async function updateValidationRun(runId, patch) {
  ensureDbConnected();
  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    params.push(patch.status);
    updates.push(`status = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'logs')) {
    params.push(JSON.stringify(patch.logs || []));
    updates.push(`logs_json = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'result')) {
    params.push(JSON.stringify(patch.result || {}));
    updates.push(`result_json = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'startedAt')) {
    params.push(patch.startedAt || null);
    updates.push(`started_at = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'finishedAt')) {
    params.push(patch.finishedAt || null);
    updates.push(`finished_at = $${params.length}`);
  }

  if (updates.length === 0) {
    return getValidationRunById(runId);
  }

  params.push(runId);
  const result = await db.query(
    `
      UPDATE validation_runs
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length}
      RETURNING *
    `,
    params,
  );

  if (result.rows.length === 0) {
    return null;
  }
  return mapValidationRunRow(result.rows[0]);
}

async function getValidationRunById(runId) {
  ensureDbConnected();
  const result = await db.query(
    `
      SELECT *
      FROM validation_runs
      WHERE id = $1
      LIMIT 1
    `,
    [runId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapValidationRunRow(result.rows[0]);
}

async function createReleaseRecord({
  tenantId,
  domain,
  itemId,
  fromVersion,
  toVersion,
  channel,
  action,
  status,
  notes,
  validationRunId,
  triggeredByUserId,
}) {
  ensureDbConnected();
  const result = await db.query(
    `
      INSERT INTO release_records (
        tenant_id,
        domain,
        item_id,
        from_version,
        to_version,
        channel,
        action,
        status,
        notes,
        validation_run_id,
        triggered_by_user_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `,
    [
      tenantId,
      domain,
      itemId,
      fromVersion || null,
      toVersion,
      channel,
      action,
      status,
      notes || null,
      validationRunId || null,
      triggeredByUserId || null,
    ],
  );
  return mapReleaseRecordRow(result.rows[0]);
}

async function listReleaseRecords({ tenantId, domain, channel, limit, offset }) {
  ensureDbConnected();
  const normalizedLimit = Math.max(1, Math.min(toInt(limit, 50), 200));
  const normalizedOffset = Math.max(0, toInt(offset, 0));
  const params = [tenantId];
  let whereClause = 'WHERE tenant_id = $1';

  if (typeof domain === 'string' && domain.trim().length > 0) {
    params.push(domain.trim());
    whereClause += ` AND domain = $${params.length}`;
  }
  if (typeof channel === 'string' && channel.trim().length > 0) {
    params.push(channel.trim());
    whereClause += ` AND channel = $${params.length}`;
  }

  const query = `
    SELECT *
    FROM release_records
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
  params.push(normalizedLimit);
  params.push(normalizedOffset);
  const result = await db.query(query, params);
  return {
    data: result.rows.map(mapReleaseRecordRow),
    pagination: {
      limit: normalizedLimit,
      offset: normalizedOffset,
      count: result.rows.length,
    },
  };
}

async function insertAuditLog({
  actorUserId,
  tenantId,
  action,
  targetType,
  targetId,
  beforeState,
  afterState,
  metadata,
}) {
  ensureDbConnected();
  const result = await db.query(
    `
      INSERT INTO audit_logs (
        actor_user_id,
        tenant_id,
        action,
        target_type,
        target_id,
        before_state,
        after_state,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
    `,
    [
      actorUserId || null,
      tenantId || null,
      action,
      targetType || null,
      targetId || null,
      beforeState || null,
      afterState || null,
      metadata || {},
    ],
  );
  return result.rows[0]?.id || null;
}

module.exports = {
  DOMAIN_CONFIG,
  normalizeDomain,
  getDomainConfig,
  listCatalogEntries,
  listCatalogRevisions,
  getCatalogRevisionByVersion,
  getLatestPublishedRevision,
  createCatalogRevision,
  updateCatalogRevisionByVersion,
  markPublishedRevisionAsDeprecated,
  createValidationRun,
  updateValidationRun,
  getValidationRunById,
  createReleaseRecord,
  listReleaseRecords,
  insertAuditLog,
};
