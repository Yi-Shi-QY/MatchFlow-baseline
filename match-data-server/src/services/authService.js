const crypto = require('crypto');
const db = require('../../db');
const userRepository = require('../repositories/userRepository');
const sessionRepository = require('../repositories/sessionRepository');
const { verifyPassword } = require('./passwordService');
const {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
} = require('./tokenService');
const { hasPermission, listScopedPermissions } = require('./permissionService');

class AuthError extends Error {
  constructor(message, code = 'AUTH_ERROR', statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function generateSessionId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function normalizeIdentifier(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

function ensureDbConnected() {
  if (!db.isConnected()) {
    throw new AuthError('Authentication requires a configured database', 'AUTH_DB_REQUIRED', 503);
  }
}

function buildSessionExpiration() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

function buildAuthContext(user, sessionId, source) {
  return {
    mode: 'user',
    source,
    sessionId,
    userId: user.id,
    tenantId: user.tenantId,
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    user: sanitizeUser(user),
  };
}

async function loadActiveUserContext(userId) {
  const user = await userRepository.getUserAuthContext(userId);
  if (!user || user.status !== 'active') {
    throw new AuthError('User is disabled or not found', 'AUTH_USER_INACTIVE', 401);
  }
  return user;
}

async function login({ identifier, password, ipAddress, userAgent }) {
  ensureDbConnected();

  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier || typeof password !== 'string' || password.length === 0) {
    throw new AuthError('identifier and password are required', 'AUTH_INVALID_REQUEST', 400);
  }

  const user = await userRepository.getUserByIdentifier(normalizedIdentifier);
  if (!user || user.status !== 'active') {
    throw new AuthError('Invalid credentials', 'AUTH_INVALID_CREDENTIALS', 401);
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AuthError('Invalid credentials', 'AUTH_INVALID_CREDENTIALS', 401);
  }

  const userContext = await loadActiveUserContext(user.id);
  const sessionId = generateSessionId();
  const refreshToken = issueRefreshToken({
    sessionId,
    userId: userContext.id,
    tenantId: userContext.tenantId,
  });

  await sessionRepository.createSession({
    sessionId,
    userId: userContext.id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt: buildSessionExpiration(),
    userAgent,
    ipAddress,
  });

  const accessToken = issueAccessToken({
    sessionId,
    userId: userContext.id,
    tenantId: userContext.tenantId,
    roles: userContext.roles,
    permissions: userContext.permissions,
  });

  return {
    tokenType: 'Bearer',
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
    user: sanitizeUser(userContext),
  };
}

async function refresh({ refreshToken, ipAddress, userAgent }) {
  ensureDbConnected();

  if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
    throw new AuthError('refreshToken is required', 'AUTH_INVALID_REQUEST', 400);
  }

  let refreshPayload;
  try {
    refreshPayload = verifyRefreshToken(refreshToken.trim());
  } catch (error) {
    throw new AuthError('Invalid refresh token', 'AUTH_INVALID_REFRESH', 401);
  }

  const session = await sessionRepository.getSessionById(refreshPayload.sessionId);
  if (!session) {
    throw new AuthError('Session not found', 'AUTH_SESSION_NOT_FOUND', 401);
  }
  if (session.revokedAt) {
    throw new AuthError('Session revoked', 'AUTH_SESSION_REVOKED', 401);
  }
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new AuthError('Session expired', 'AUTH_SESSION_EXPIRED', 401);
  }
  if (!verifyRefreshTokenHash(refreshToken.trim(), session.refreshTokenHash)) {
    throw new AuthError('Invalid refresh token', 'AUTH_INVALID_REFRESH', 401);
  }
  if (session.userStatus !== 'active') {
    throw new AuthError('User is disabled', 'AUTH_USER_INACTIVE', 401);
  }

  const userContext = await loadActiveUserContext(session.userId);
  const nextRefreshToken = issueRefreshToken({
    sessionId: session.id,
    userId: userContext.id,
    tenantId: userContext.tenantId,
  });

  await sessionRepository.rotateSession(session.id, {
    refreshTokenHash: hashRefreshToken(nextRefreshToken),
    expiresAt: buildSessionExpiration(),
    userAgent,
    ipAddress,
  });

  const accessToken = issueAccessToken({
    sessionId: session.id,
    userId: userContext.id,
    tenantId: userContext.tenantId,
    roles: userContext.roles,
    permissions: userContext.permissions,
  });

  return {
    tokenType: 'Bearer',
    accessToken,
    refreshToken: nextRefreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
    user: sanitizeUser(userContext),
  };
}

async function logout({ sessionId, refreshToken }) {
  ensureDbConnected();

  let targetSessionId = typeof sessionId === 'string' ? sessionId.trim() : '';
  if (!targetSessionId && typeof refreshToken === 'string' && refreshToken.trim().length > 0) {
    try {
      const payload = verifyRefreshToken(refreshToken.trim());
      targetSessionId = payload.sessionId;
    } catch (error) {
      throw new AuthError('Invalid refresh token', 'AUTH_INVALID_REFRESH', 401);
    }
  }

  if (!targetSessionId) {
    throw new AuthError('sessionId or refreshToken is required', 'AUTH_INVALID_REQUEST', 400);
  }

  await sessionRepository.revokeSession(targetSessionId);
  return { sessionId: targetSessionId };
}

async function authenticateAccessToken(accessToken) {
  let tokenPayload;
  try {
    tokenPayload = verifyAccessToken(accessToken);
  } catch (error) {
    throw new AuthError('Invalid or expired access token', 'AUTH_INVALID_ACCESS', 401);
  }

  if (!db.isConnected()) {
    return {
      mode: 'user',
      source: 'token',
      sessionId: tokenPayload.sessionId,
      userId: tokenPayload.userId,
      tenantId: tokenPayload.tenantId,
      roles: tokenPayload.roles,
      permissions: tokenPayload.permissions,
      user: {
        id: tokenPayload.userId,
        tenantId: tokenPayload.tenantId,
        roles: tokenPayload.roles,
        permissions: tokenPayload.permissions,
      },
    };
  }

  const session = await sessionRepository.getSessionById(tokenPayload.sessionId);
  if (!session) {
    throw new AuthError('Session not found', 'AUTH_SESSION_NOT_FOUND', 401);
  }
  if (session.revokedAt) {
    throw new AuthError('Session revoked', 'AUTH_SESSION_REVOKED', 401);
  }
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new AuthError('Session expired', 'AUTH_SESSION_EXPIRED', 401);
  }

  const userContext = await loadActiveUserContext(tokenPayload.userId);
  return buildAuthContext(userContext, tokenPayload.sessionId, 'database');
}

async function getCurrentUser(authContext) {
  if (!authContext || authContext.mode !== 'user') {
    throw new AuthError('User authentication required', 'AUTH_USER_REQUIRED', 401);
  }

  if (!db.isConnected()) {
    return authContext.user || null;
  }

  const userContext = await loadActiveUserContext(authContext.userId);
  return sanitizeUser(userContext);
}

async function getCapabilities(authContext) {
  const user = await getCurrentUser(authContext);
  const capabilityContext = {
    ...authContext,
    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
  };

  return {
    user,
    availableDataSources: listScopedPermissions(capabilityContext, 'datasource:use:'),
    availableTemplates: listScopedPermissions(capabilityContext, 'template:use:'),
    recommendedTemplates: listScopedPermissions(capabilityContext, 'template:use:'),
    canUseAdminConsole: hasPermission(capabilityContext, 'admin:*'),
  };
}

module.exports = {
  AuthError,
  login,
  refresh,
  logout,
  authenticateAccessToken,
  getCurrentUser,
  getCapabilities,
};
