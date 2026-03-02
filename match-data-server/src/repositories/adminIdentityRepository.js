const db = require('../../db');

function ensureDbConnected() {
  if (!db.isConnected()) {
    throw new Error('Database not connected');
  }
}

function toInteger(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function mapUserRow(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    roles: Array.isArray(row.role_codes) ? row.role_codes : [],
  };
}

function mapRoleRow(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isSystem: row.is_system,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    permissions: Array.isArray(row.permission_codes) ? row.permission_codes : [],
  };
}

function mapPermissionRow(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isSystem: row.is_system,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuditRow(row) {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorUsername: row.actor_username || null,
    tenantId: row.tenant_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    beforeState: row.before_state,
    afterState: row.after_state,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

async function listUsers(filters = {}) {
  ensureDbConnected();

  const limit = Math.max(1, Math.min(toInteger(filters.limit, 50), 200));
  const offset = Math.max(0, toInteger(filters.offset, 0));

  let query = `
    SELECT
      u.id,
      u.tenant_id,
      u.username,
      u.email,
      u.display_name,
      u.status,
      u.last_login_at,
      u.created_at,
      u.updated_at,
      COALESCE(array_remove(array_agg(DISTINCT r.code), NULL), '{}') AS role_codes
    FROM users u
    LEFT JOIN user_roles ur
      ON ur.user_id = u.id AND ur.is_active = TRUE
    LEFT JOIN roles r
      ON r.id = ur.role_id
    WHERE 1=1
  `;
  const params = [];

  if (typeof filters.tenantId === 'string' && filters.tenantId.trim().length > 0) {
    params.push(filters.tenantId.trim());
    query += ` AND u.tenant_id = $${params.length}`;
  }

  if (typeof filters.status === 'string' && filters.status.trim().length > 0) {
    params.push(filters.status.trim());
    query += ` AND u.status = $${params.length}`;
  }

  if (typeof filters.search === 'string' && filters.search.trim().length > 0) {
    params.push(`%${filters.search.trim()}%`);
    query += ` AND (u.username ILIKE $${params.length} OR u.email ILIKE $${params.length} OR COALESCE(u.display_name, '') ILIKE $${params.length})`;
  }

  query += ' GROUP BY u.id';
  query += ' ORDER BY u.created_at DESC';
  params.push(limit);
  query += ` LIMIT $${params.length}`;
  params.push(offset);
  query += ` OFFSET $${params.length}`;

  const result = await db.query(query, params);
  return {
    data: result.rows.map(mapUserRow),
    pagination: {
      limit,
      offset,
      count: result.rows.length,
    },
  };
}

async function getUserById(userId) {
  ensureDbConnected();

  const query = `
    SELECT
      u.id,
      u.tenant_id,
      u.username,
      u.email,
      u.display_name,
      u.status,
      u.last_login_at,
      u.created_at,
      u.updated_at,
      COALESCE(array_remove(array_agg(DISTINCT r.code), NULL), '{}') AS role_codes
    FROM users u
    LEFT JOIN user_roles ur
      ON ur.user_id = u.id AND ur.is_active = TRUE
    LEFT JOIN roles r
      ON r.id = ur.role_id
    WHERE u.id = $1
    GROUP BY u.id
    LIMIT 1
  `;
  const result = await db.query(query, [userId]);
  if (result.rows.length === 0) {
    return null;
  }
  return mapUserRow(result.rows[0]);
}

async function createUser(payload) {
  ensureDbConnected();

  const query = `
    INSERT INTO users (
      tenant_id,
      username,
      email,
      display_name,
      password_hash,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const result = await db.query(query, [
    payload.tenantId,
    payload.username,
    payload.email,
    payload.displayName || null,
    payload.passwordHash,
    payload.status || 'active',
  ]);
  return mapUserRow(result.rows[0]);
}

async function updateUser(userId, patch) {
  ensureDbConnected();

  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(patch, 'email')) {
    params.push(patch.email);
    updates.push(`email = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'displayName')) {
    params.push(patch.displayName || null);
    updates.push(`display_name = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    params.push(patch.status);
    updates.push(`status = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'passwordHash')) {
    params.push(patch.passwordHash);
    updates.push(`password_hash = $${params.length}`);
  }

  if (updates.length === 0) {
    return getUserById(userId);
  }

  params.push(userId);
  const query = `
    UPDATE users
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE id = $${params.length}
    RETURNING id
  `;
  const result = await db.query(query, params);
  if (result.rows.length === 0) {
    return null;
  }
  return getUserById(userId);
}

async function resolveRoleIdsByCodes(roleCodes) {
  ensureDbConnected();
  const normalizedCodes = Array.from(
    new Set(
      (Array.isArray(roleCodes) ? roleCodes : [])
        .filter((code) => typeof code === 'string')
        .map((code) => code.trim())
        .filter((code) => code.length > 0),
    ),
  );

  if (normalizedCodes.length === 0) {
    return [];
  }

  const result = await db.query(
    `
      SELECT id, code
      FROM roles
      WHERE code = ANY($1) AND is_active = TRUE
    `,
    [normalizedCodes],
  );
  return result.rows;
}

async function setUserRolesByCodes(userId, roleCodes) {
  ensureDbConnected();

  const roleRows = await resolveRoleIdsByCodes(roleCodes);
  if (roleRows.length !== (Array.isArray(roleCodes) ? new Set(roleCodes).size : 0)) {
    const existingCodes = new Set(roleRows.map((row) => row.code));
    const missingCodes = (Array.isArray(roleCodes) ? roleCodes : [])
      .filter((code) => typeof code === 'string' && code.trim().length > 0)
      .map((code) => code.trim())
      .filter((code) => !existingCodes.has(code));
    throw new Error(`Unknown role codes: ${missingCodes.join(', ')}`);
  }

  await db.query('UPDATE user_roles SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1', [
    userId,
  ]);

  for (const roleRow of roleRows) {
    await db.query(
      `
        INSERT INTO user_roles (user_id, role_id, is_active)
        VALUES ($1, $2, TRUE)
        ON CONFLICT (user_id, role_id)
        DO UPDATE SET is_active = TRUE, updated_at = NOW()
      `,
      [userId, roleRow.id],
    );
  }

  return getUserById(userId);
}

async function listRoles() {
  ensureDbConnected();
  const query = `
    SELECT
      r.id,
      r.code,
      r.name,
      r.description,
      r.is_system,
      r.is_active,
      r.created_at,
      r.updated_at,
      COALESCE(array_remove(array_agg(DISTINCT p.code), NULL), '{}') AS permission_codes
    FROM roles r
    LEFT JOIN role_permissions rp
      ON rp.role_id = r.id
    LEFT JOIN permissions p
      ON p.id = rp.permission_id
    GROUP BY r.id
    ORDER BY r.code ASC
  `;
  const result = await db.query(query);
  return result.rows.map(mapRoleRow);
}

async function getRoleById(roleId) {
  ensureDbConnected();
  const query = `
    SELECT
      r.id,
      r.code,
      r.name,
      r.description,
      r.is_system,
      r.is_active,
      r.created_at,
      r.updated_at,
      COALESCE(array_remove(array_agg(DISTINCT p.code), NULL), '{}') AS permission_codes
    FROM roles r
    LEFT JOIN role_permissions rp
      ON rp.role_id = r.id
    LEFT JOIN permissions p
      ON p.id = rp.permission_id
    WHERE r.id = $1
    GROUP BY r.id
    LIMIT 1
  `;
  const result = await db.query(query, [roleId]);
  if (result.rows.length === 0) {
    return null;
  }
  return mapRoleRow(result.rows[0]);
}

async function createRole(payload) {
  ensureDbConnected();
  const result = await db.query(
    `
      INSERT INTO roles (code, name, description, is_system, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [payload.code, payload.name, payload.description || null, !!payload.isSystem, payload.isActive !== false],
  );
  return getRoleById(result.rows[0].id);
}

async function updateRole(roleId, patch) {
  ensureDbConnected();
  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
    params.push(patch.name);
    updates.push(`name = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
    params.push(patch.description || null);
    updates.push(`description = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'isActive')) {
    params.push(!!patch.isActive);
    updates.push(`is_active = $${params.length}`);
  }

  if (updates.length === 0) {
    return getRoleById(roleId);
  }

  params.push(roleId);
  const query = `
    UPDATE roles
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE id = $${params.length}
    RETURNING id
  `;
  const result = await db.query(query, params);
  if (result.rows.length === 0) {
    return null;
  }
  return getRoleById(roleId);
}

async function resolvePermissionIdsByCodes(permissionCodes) {
  ensureDbConnected();
  const normalizedCodes = Array.from(
    new Set(
      (Array.isArray(permissionCodes) ? permissionCodes : [])
        .filter((code) => typeof code === 'string')
        .map((code) => code.trim())
        .filter((code) => code.length > 0),
    ),
  );
  if (normalizedCodes.length === 0) {
    return [];
  }

  const result = await db.query(
    `
      SELECT id, code
      FROM permissions
      WHERE code = ANY($1) AND is_active = TRUE
    `,
    [normalizedCodes],
  );
  return result.rows;
}

async function setRolePermissionsByCodes(roleId, permissionCodes) {
  ensureDbConnected();

  const permissionRows = await resolvePermissionIdsByCodes(permissionCodes);
  if (permissionRows.length !== (Array.isArray(permissionCodes) ? new Set(permissionCodes).size : 0)) {
    const existingCodes = new Set(permissionRows.map((row) => row.code));
    const missingCodes = (Array.isArray(permissionCodes) ? permissionCodes : [])
      .filter((code) => typeof code === 'string' && code.trim().length > 0)
      .map((code) => code.trim())
      .filter((code) => !existingCodes.has(code));
    throw new Error(`Unknown permission codes: ${missingCodes.join(', ')}`);
  }

  await db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
  for (const permissionRow of permissionRows) {
    await db.query(
      `
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [roleId, permissionRow.id],
    );
  }

  return getRoleById(roleId);
}

async function listPermissions() {
  ensureDbConnected();
  const result = await db.query(
    `
      SELECT
        id,
        code,
        name,
        description,
        is_system,
        is_active,
        created_at,
        updated_at
      FROM permissions
      ORDER BY code ASC
    `,
  );
  return result.rows.map(mapPermissionRow);
}

async function createPermission(payload) {
  ensureDbConnected();
  const result = await db.query(
    `
      INSERT INTO permissions (code, name, description, is_system, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [payload.code, payload.name, payload.description || null, !!payload.isSystem, payload.isActive !== false],
  );
  return mapPermissionRow(result.rows[0]);
}

async function insertAuditLog(entry) {
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      entry.actorUserId || null,
      entry.tenantId || null,
      entry.action,
      entry.targetType || null,
      entry.targetId || null,
      entry.beforeState || null,
      entry.afterState || null,
      entry.metadata || {},
    ],
  );
  return mapAuditRow(result.rows[0]);
}

async function listAuditLogs(filters = {}) {
  ensureDbConnected();

  const limit = Math.max(1, Math.min(toInteger(filters.limit, 50), 200));
  const offset = Math.max(0, toInteger(filters.offset, 0));

  let query = `
    SELECT
      a.id,
      a.actor_user_id,
      u.username AS actor_username,
      a.tenant_id,
      a.action,
      a.target_type,
      a.target_id,
      a.before_state,
      a.after_state,
      a.metadata,
      a.created_at
    FROM audit_logs a
    LEFT JOIN users u
      ON u.id = a.actor_user_id
    WHERE 1=1
  `;
  const params = [];

  if (typeof filters.tenantId === 'string' && filters.tenantId.trim().length > 0) {
    params.push(filters.tenantId.trim());
    query += ` AND a.tenant_id = $${params.length}`;
  }

  if (typeof filters.action === 'string' && filters.action.trim().length > 0) {
    params.push(filters.action.trim());
    query += ` AND a.action = $${params.length}`;
  }

  if (typeof filters.actorUserId === 'string' && filters.actorUserId.trim().length > 0) {
    params.push(filters.actorUserId.trim());
    query += ` AND a.actor_user_id = $${params.length}`;
  }

  query += ' ORDER BY a.created_at DESC';
  params.push(limit);
  query += ` LIMIT $${params.length}`;
  params.push(offset);
  query += ` OFFSET $${params.length}`;

  const result = await db.query(query, params);
  return {
    data: result.rows.map(mapAuditRow),
    pagination: {
      limit,
      offset,
      count: result.rows.length,
    },
  };
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  setUserRolesByCodes,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  setRolePermissionsByCodes,
  listPermissions,
  createPermission,
  insertAuditLog,
  listAuditLogs,
};
