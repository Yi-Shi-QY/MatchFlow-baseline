const {
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
} = require('../repositories/adminIdentityRepository');
const { hashPassword } = require('./passwordService');

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_:-]{1,63}$/;
const PERMISSION_CODE_PATTERN = /^[a-z][a-z0-9_:-]{1,127}$/;

class AdminIdentityError extends Error {
  constructor(message, code = 'ADMIN_IDENTITY_ERROR', statusCode = 400) {
    super(message);
    this.name = 'AdminIdentityError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeArray(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function resolveActorContext(authContext) {
  return {
    actorUserId: authContext?.userId || null,
    tenantId: authContext?.tenantId || DEFAULT_TENANT_ID,
  };
}

async function writeAudit({
  authContext,
  action,
  targetType,
  targetId,
  beforeState,
  afterState,
  metadata,
}) {
  const actor = resolveActorContext(authContext);
  return insertAuditLog({
    actorUserId: actor.actorUserId,
    tenantId: actor.tenantId,
    action,
    targetType,
    targetId,
    beforeState,
    afterState,
    metadata,
  });
}

function validateRoleCodes(roleCodes) {
  const normalizedCodes = normalizeArray(roleCodes);
  if (normalizedCodes.some((code) => !ROLE_CODE_PATTERN.test(code))) {
    throw new AdminIdentityError(
      'roleCodes contains invalid role code format',
      'ADMIN_ROLE_CODE_INVALID',
      400,
    );
  }
  return normalizedCodes;
}

function validatePermissionCodes(permissionCodes) {
  const normalizedCodes = normalizeArray(permissionCodes);
  if (normalizedCodes.some((code) => !PERMISSION_CODE_PATTERN.test(code))) {
    throw new AdminIdentityError(
      'permissionCodes contains invalid permission code format',
      'ADMIN_PERMISSION_CODE_INVALID',
      400,
    );
  }
  return normalizedCodes;
}

async function listUsersForAdmin(query) {
  return listUsers(query || {});
}

async function createUserForAdmin(body, authContext) {
  const username = normalizeString(body?.username);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  const displayName = normalizeString(body?.displayName);
  const status = normalizeString(body?.status) || 'active';
  const tenantId = normalizeString(body?.tenantId) || authContext?.tenantId || DEFAULT_TENANT_ID;
  const roleCodes = validateRoleCodes(body?.roleCodes);

  if (!username) {
    throw new AdminIdentityError('username is required', 'ADMIN_USER_USERNAME_REQUIRED', 400);
  }
  if (!email) {
    throw new AdminIdentityError('email is required', 'ADMIN_USER_EMAIL_REQUIRED', 400);
  }
  if (password.length < 8) {
    throw new AdminIdentityError(
      'password must be at least 8 characters',
      'ADMIN_USER_PASSWORD_WEAK',
      400,
    );
  }
  if (!['active', 'disabled'].includes(status)) {
    throw new AdminIdentityError('status must be active or disabled', 'ADMIN_USER_STATUS_INVALID', 400);
  }

  const passwordHash = await hashPassword(password);
  let createdUser;
  try {
    createdUser = await createUser({
      tenantId,
      username,
      email,
      displayName: displayName || null,
      passwordHash,
      status,
    });
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      throw new AdminIdentityError('username or email already exists', 'ADMIN_USER_CONFLICT', 409);
    }
    throw error;
  }

  if (roleCodes.length > 0) {
    createdUser = await setUserRolesByCodes(createdUser.id, roleCodes);
  }

  await writeAudit({
    authContext,
    action: 'admin.user.create',
    targetType: 'user',
    targetId: createdUser.id,
    beforeState: null,
    afterState: createdUser,
    metadata: {
      roleCodes,
    },
  });

  return createdUser;
}

async function updateUserForAdmin(userId, body, authContext) {
  const existing = await getUserById(userId);
  if (!existing) {
    throw new AdminIdentityError('User not found', 'ADMIN_USER_NOT_FOUND', 404);
  }

  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body || {}, 'email')) {
    const email = normalizeEmail(body.email);
    if (!email) {
      throw new AdminIdentityError('email cannot be empty', 'ADMIN_USER_EMAIL_INVALID', 400);
    }
    patch.email = email;
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'displayName')) {
    patch.displayName = normalizeString(body.displayName) || null;
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'status')) {
    const status = normalizeString(body.status);
    if (!['active', 'disabled'].includes(status)) {
      throw new AdminIdentityError('status must be active or disabled', 'ADMIN_USER_STATUS_INVALID', 400);
    }
    patch.status = status;
  }
  if (typeof body?.password === 'string' && body.password.length > 0) {
    if (body.password.length < 8) {
      throw new AdminIdentityError(
        'password must be at least 8 characters',
        'ADMIN_USER_PASSWORD_WEAK',
        400,
      );
    }
    patch.passwordHash = await hashPassword(body.password);
  }

  let updated;
  try {
    updated = await updateUser(userId, patch);
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      throw new AdminIdentityError('email already exists', 'ADMIN_USER_CONFLICT', 409);
    }
    throw error;
  }
  if (!updated) {
    throw new AdminIdentityError('User not found', 'ADMIN_USER_NOT_FOUND', 404);
  }

  await writeAudit({
    authContext,
    action: 'admin.user.update',
    targetType: 'user',
    targetId: updated.id,
    beforeState: existing,
    afterState: updated,
    metadata: {
      updatedFields: Object.keys(patch),
    },
  });

  return updated;
}

async function setUserRolesForAdmin(userId, body, authContext) {
  const existing = await getUserById(userId);
  if (!existing) {
    throw new AdminIdentityError('User not found', 'ADMIN_USER_NOT_FOUND', 404);
  }

  const roleCodes = validateRoleCodes(body?.roleCodes);
  let updated;
  try {
    updated = await setUserRolesByCodes(userId, roleCodes);
  } catch (error) {
    if (String(error?.message || '').startsWith('Unknown role codes:')) {
      throw new AdminIdentityError(error.message, 'ADMIN_ROLE_UNKNOWN', 400);
    }
    throw error;
  }

  await writeAudit({
    authContext,
    action: 'admin.user.roles.set',
    targetType: 'user',
    targetId: userId,
    beforeState: { roles: existing.roles },
    afterState: { roles: updated?.roles || [] },
    metadata: {
      roleCodes,
    },
  });

  return updated;
}

async function listRolesForAdmin() {
  return listRoles();
}

async function createRoleForAdmin(body, authContext) {
  const code = normalizeString(body?.code);
  const name = normalizeString(body?.name);
  const description = normalizeString(body?.description);
  const isActive = body?.isActive !== false;
  const permissionCodes = validatePermissionCodes(body?.permissionCodes);

  if (!ROLE_CODE_PATTERN.test(code)) {
    throw new AdminIdentityError(
      'code is required and must match role code format',
      'ADMIN_ROLE_CODE_INVALID',
      400,
    );
  }
  if (!name) {
    throw new AdminIdentityError('name is required', 'ADMIN_ROLE_NAME_REQUIRED', 400);
  }

  let createdRole;
  try {
    createdRole = await createRole({
      code,
      name,
      description: description || null,
      isSystem: false,
      isActive,
    });
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      throw new AdminIdentityError('role code already exists', 'ADMIN_ROLE_CONFLICT', 409);
    }
    throw error;
  }

  if (permissionCodes.length > 0) {
    try {
      createdRole = await setRolePermissionsByCodes(createdRole.id, permissionCodes);
    } catch (error) {
      if (String(error?.message || '').startsWith('Unknown permission codes:')) {
        throw new AdminIdentityError(error.message, 'ADMIN_PERMISSION_UNKNOWN', 400);
      }
      throw error;
    }
  }

  await writeAudit({
    authContext,
    action: 'admin.role.create',
    targetType: 'role',
    targetId: createdRole.id,
    beforeState: null,
    afterState: createdRole,
    metadata: {
      permissionCodes,
    },
  });

  return createdRole;
}

async function updateRoleForAdmin(roleId, body, authContext) {
  const existing = await getRoleById(roleId);
  if (!existing) {
    throw new AdminIdentityError('Role not found', 'ADMIN_ROLE_NOT_FOUND', 404);
  }

  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body || {}, 'name')) {
    const name = normalizeString(body.name);
    if (!name) {
      throw new AdminIdentityError('name cannot be empty', 'ADMIN_ROLE_NAME_REQUIRED', 400);
    }
    patch.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'description')) {
    patch.description = normalizeString(body.description) || null;
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'isActive')) {
    patch.isActive = !!body.isActive;
  }

  let updated = await updateRole(roleId, patch);
  if (!updated) {
    throw new AdminIdentityError('Role not found', 'ADMIN_ROLE_NOT_FOUND', 404);
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'permissionCodes')) {
    const permissionCodes = validatePermissionCodes(body.permissionCodes);
    try {
      updated = await setRolePermissionsByCodes(roleId, permissionCodes);
    } catch (error) {
      if (String(error?.message || '').startsWith('Unknown permission codes:')) {
        throw new AdminIdentityError(error.message, 'ADMIN_PERMISSION_UNKNOWN', 400);
      }
      throw error;
    }
  }

  await writeAudit({
    authContext,
    action: 'admin.role.update',
    targetType: 'role',
    targetId: roleId,
    beforeState: existing,
    afterState: updated,
    metadata: {
      updatedFields: Object.keys(body || {}),
    },
  });

  return updated;
}

async function setRolePermissionsForAdmin(roleId, body, authContext) {
  const existing = await getRoleById(roleId);
  if (!existing) {
    throw new AdminIdentityError('Role not found', 'ADMIN_ROLE_NOT_FOUND', 404);
  }

  const permissionCodes = validatePermissionCodes(body?.permissionCodes);
  let updated;
  try {
    updated = await setRolePermissionsByCodes(roleId, permissionCodes);
  } catch (error) {
    if (String(error?.message || '').startsWith('Unknown permission codes:')) {
      throw new AdminIdentityError(error.message, 'ADMIN_PERMISSION_UNKNOWN', 400);
    }
    throw error;
  }

  await writeAudit({
    authContext,
    action: 'admin.role.permissions.set',
    targetType: 'role',
    targetId: roleId,
    beforeState: { permissions: existing.permissions },
    afterState: { permissions: updated?.permissions || [] },
    metadata: {
      permissionCodes,
    },
  });

  return updated;
}

async function listPermissionsForAdmin() {
  return listPermissions();
}

async function createPermissionForAdmin(body, authContext) {
  const code = normalizeString(body?.code);
  const name = normalizeString(body?.name);
  const description = normalizeString(body?.description);
  const isActive = body?.isActive !== false;

  if (!PERMISSION_CODE_PATTERN.test(code)) {
    throw new AdminIdentityError(
      'code is required and must match permission code format',
      'ADMIN_PERMISSION_CODE_INVALID',
      400,
    );
  }
  if (!name) {
    throw new AdminIdentityError('name is required', 'ADMIN_PERMISSION_NAME_REQUIRED', 400);
  }

  let created;
  try {
    created = await createPermission({
      code,
      name,
      description: description || null,
      isSystem: false,
      isActive,
    });
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      throw new AdminIdentityError(
        'permission code already exists',
        'ADMIN_PERMISSION_CONFLICT',
        409,
      );
    }
    throw error;
  }

  await writeAudit({
    authContext,
    action: 'admin.permission.create',
    targetType: 'permission',
    targetId: created.id,
    beforeState: null,
    afterState: created,
    metadata: null,
  });

  return created;
}

async function listAuditLogsForAdmin(query) {
  return listAuditLogs(query || {});
}

module.exports = {
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
};
