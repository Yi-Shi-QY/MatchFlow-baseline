const db = require('../../db');

function ensureDbConnected() {
  if (!db.isConnected()) {
    throw new Error('Database not connected');
  }
}

function mapSessionRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    userAgent: row.user_agent,
    ipAddress: row.ip_address,
    userStatus: row.user_status,
    tenantId: row.tenant_id,
  };
}

async function createSession({
  sessionId,
  userId,
  refreshTokenHash,
  expiresAt,
  userAgent,
  ipAddress,
}) {
  ensureDbConnected();
  const query = `
    INSERT INTO sessions (
      id,
      user_id,
      refresh_token_hash,
      expires_at,
      user_agent,
      ip_address,
      last_seen_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *
  `;
  const result = await db.query(query, [
    sessionId,
    userId,
    refreshTokenHash,
    expiresAt,
    userAgent || null,
    ipAddress || null,
  ]);
  return mapSessionRow(result.rows[0]);
}

async function getSessionById(sessionId) {
  ensureDbConnected();
  const query = `
    SELECT
      s.*,
      u.status AS user_status,
      u.tenant_id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = $1
    LIMIT 1
  `;
  const result = await db.query(query, [sessionId]);
  if (result.rows.length === 0) {
    return null;
  }
  return mapSessionRow(result.rows[0]);
}

async function rotateSession(sessionId, { refreshTokenHash, expiresAt, userAgent, ipAddress }) {
  ensureDbConnected();
  const query = `
    UPDATE sessions
    SET
      refresh_token_hash = $2,
      expires_at = $3,
      user_agent = COALESCE($4, user_agent),
      ip_address = COALESCE($5, ip_address),
      revoked_at = NULL,
      last_seen_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const result = await db.query(query, [
    sessionId,
    refreshTokenHash,
    expiresAt,
    userAgent || null,
    ipAddress || null,
  ]);
  if (result.rows.length === 0) {
    return null;
  }
  return mapSessionRow(result.rows[0]);
}

async function revokeSession(sessionId) {
  ensureDbConnected();
  const query = `
    UPDATE sessions
    SET revoked_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING id
  `;
  const result = await db.query(query, [sessionId]);
  return result.rows.length > 0;
}

module.exports = {
  createSession,
  getSessionById,
  rotateSession,
  revokeSession,
};
