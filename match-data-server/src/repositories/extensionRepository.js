const db = require('../../db');

function isConnected() {
  return db.isConnected();
}

async function getManifestByVersion(kind, extensionId, version) {
  if (!isConnected()) return null;

  const query = `
    SELECT *
    FROM extension_manifests
    WHERE kind = $1
      AND extension_id = $2
      AND version = $3
    LIMIT 1
  `;
  const result = await db.query(query, [kind, extensionId, version]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function listManifestsByExtension(kind, extensionId, options = {}) {
  if (!isConnected()) return [];

  const where = ['kind = $1', 'extension_id = $2'];
  const params = [kind, extensionId];

  if (options.channel) {
    params.push(options.channel);
    where.push(`channel = $${params.length}`);
  }

  if (Array.isArray(options.statuses) && options.statuses.length > 0) {
    params.push(options.statuses);
    where.push(`status = ANY($${params.length})`);
  }

  const query = `
    SELECT *
    FROM extension_manifests
    WHERE ${where.join(' AND ')}
    ORDER BY updated_at DESC
  `;
  const result = await db.query(query, params);
  return result.rows;
}

async function listManifests(options = {}) {
  if (!isConnected()) return [];

  const where = ['1=1'];
  const params = [];

  if (options.kind) {
    params.push(options.kind);
    where.push(`kind = $${params.length}`);
  }

  if (options.extensionId) {
    params.push(options.extensionId);
    where.push(`extension_id = $${params.length}`);
  }

  if (options.channel) {
    params.push(options.channel);
    where.push(`channel = $${params.length}`);
  }

  if (Array.isArray(options.statuses) && options.statuses.length > 0) {
    params.push(options.statuses);
    where.push(`status = ANY($${params.length})`);
  }

  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 100;
  const offset = Number.isFinite(Number(options.offset)) ? Number(options.offset) : 0;
  params.push(limit);
  const limitIndex = params.length;
  params.push(offset);
  const offsetIndex = params.length;

  const query = `
    SELECT *
    FROM extension_manifests
    WHERE ${where.join(' AND ')}
    ORDER BY kind ASC, extension_id ASC, updated_at DESC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
  `;
  const result = await db.query(query, params);
  return result.rows;
}

async function upsertManifest(record) {
  if (!isConnected()) return null;

  const query = `
    INSERT INTO extension_manifests (
      kind,
      extension_id,
      version,
      name,
      description,
      manifest_json,
      channel,
      status,
      checksum,
      published_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (kind, extension_id, version)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      manifest_json = EXCLUDED.manifest_json,
      channel = EXCLUDED.channel,
      status = EXCLUDED.status,
      checksum = EXCLUDED.checksum,
      published_at = EXCLUDED.published_at
    RETURNING *
  `;

  const params = [
    record.kind,
    record.extensionId,
    record.version,
    record.name,
    record.description,
    JSON.stringify(record.manifest),
    record.channel,
    record.status,
    record.checksum,
    record.publishedAt || null,
  ];

  const result = await db.query(query, params);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function patchManifest(kind, extensionId, version, patch) {
  if (!isConnected()) return null;

  const setClauses = [];
  const params = [];

  if (patch.name !== undefined) {
    params.push(patch.name);
    setClauses.push(`name = $${params.length}`);
  }

  if (patch.description !== undefined) {
    params.push(patch.description);
    setClauses.push(`description = $${params.length}`);
  }

  if (patch.manifest !== undefined) {
    params.push(JSON.stringify(patch.manifest));
    setClauses.push(`manifest_json = $${params.length}`);
  }

  if (patch.channel !== undefined) {
    params.push(patch.channel);
    setClauses.push(`channel = $${params.length}`);
  }

  if (patch.status !== undefined) {
    params.push(patch.status);
    setClauses.push(`status = $${params.length}`);
  }

  if (patch.checksum !== undefined) {
    params.push(patch.checksum);
    setClauses.push(`checksum = $${params.length}`);
  }

  if (patch.publishedAt !== undefined) {
    params.push(patch.publishedAt);
    setClauses.push(`published_at = $${params.length}`);
  }

  if (setClauses.length === 0) {
    return getManifestByVersion(kind, extensionId, version);
  }

  params.push(kind);
  const kindIndex = params.length;
  params.push(extensionId);
  const extensionIdIndex = params.length;
  params.push(version);
  const versionIndex = params.length;

  const query = `
    UPDATE extension_manifests
    SET ${setClauses.join(', ')}
    WHERE kind = $${kindIndex}
      AND extension_id = $${extensionIdIndex}
      AND version = $${versionIndex}
    RETURNING *
  `;
  const result = await db.query(query, params);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function publishManifest(kind, extensionId, version) {
  return patchManifest(kind, extensionId, version, {
    status: 'published',
    publishedAt: new Date().toISOString(),
  });
}

module.exports = {
  isConnected,
  getManifestByVersion,
  listManifestsByExtension,
  listManifests,
  upsertManifest,
  patchManifest,
  publishManifest,
};

