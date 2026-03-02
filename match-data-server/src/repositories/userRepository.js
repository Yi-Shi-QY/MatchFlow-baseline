const db = require('../../db');

function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function mapUserRow(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    status: row.status,
    roles: Array.isArray(row.roles) ? row.roles : [],
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
  };
}

async function getUserByIdentifier(identifier) {
  if (!db.isConnected()) {
    return null;
  }

  const normalizedIdentifier = normalizeString(identifier);
  if (!normalizedIdentifier) {
    return null;
  }

  const query = `
    SELECT
      u.id,
      u.tenant_id,
      u.username,
      u.email,
      u.display_name,
      u.password_hash,
      u.status
    FROM users u
    WHERE LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1)
    LIMIT 1
  `;
  const result = await db.query(query, [normalizedIdentifier]);
  if (!result || result.rows.length === 0) {
    return null;
  }
  return mapUserRow(result.rows[0]);
}

async function getUserAuthContext(userId) {
  if (!db.isConnected()) {
    return null;
  }

  const query = `
    SELECT
      u.id,
      u.tenant_id,
      u.username,
      u.email,
      u.display_name,
      u.status,
      COALESCE(array_remove(array_agg(DISTINCT r.code), NULL), '{}') AS roles,
      COALESCE(array_remove(array_agg(DISTINCT p.code), NULL), '{}') AS permissions
    FROM users u
    LEFT JOIN user_roles ur
      ON ur.user_id = u.id AND ur.is_active = TRUE
    LEFT JOIN roles r
      ON r.id = ur.role_id AND r.is_active = TRUE
    LEFT JOIN role_permissions rp
      ON rp.role_id = r.id
    LEFT JOIN permissions p
      ON p.id = rp.permission_id AND p.is_active = TRUE
    WHERE u.id = $1
    GROUP BY u.id
    LIMIT 1
  `;
  const result = await db.query(query, [userId]);
  if (!result || result.rows.length === 0) {
    return null;
  }
  return mapUserRow(result.rows[0]);
}

module.exports = {
  getUserByIdentifier,
  getUserAuthContext,
};
