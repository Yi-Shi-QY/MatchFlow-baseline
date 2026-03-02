const crypto = require('crypto');
const {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} = require('../config');

const TOKEN_HEADER = { alg: 'HS256', typ: 'JWT' };

function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLength), 'base64');
}

function buildSignature(unsignedToken, secret) {
  return crypto.createHmac('sha256', secret).update(unsignedToken).digest();
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left), 'utf8');
  const rightBuffer = Buffer.from(String(right), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function buildToken(payload, secret, ttlSeconds) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: nowInSeconds,
    exp: nowInSeconds + ttlSeconds,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(TOKEN_HEADER));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = base64UrlEncode(buildSignature(unsignedToken, secret));
  return `${unsignedToken}.${signature}`;
}

function parseToken(token, secret) {
  const segments = String(token).split('.');
  if (segments.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = base64UrlEncode(buildSignature(unsignedToken, secret));
  if (!safeEqualText(signature, expectedSignature)) {
    throw new Error('Invalid token signature');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  } catch (error) {
    throw new Error('Invalid token payload');
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowInSeconds) {
    throw new Error('Token expired');
  }

  return payload;
}

function generateId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function issueAccessToken({ sessionId, userId, tenantId, roles = [], permissions = [] }) {
  return buildToken(
    {
      typ: 'access',
      sid: sessionId,
      sub: userId,
      tid: tenantId,
      roles,
      permissions,
    },
    ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_TTL_SECONDS,
  );
}

function issueRefreshToken({ sessionId, userId, tenantId }) {
  return buildToken(
    {
      typ: 'refresh',
      sid: sessionId,
      sub: userId,
      tid: tenantId,
      jti: generateId(),
    },
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_TTL_SECONDS,
  );
}

function verifyAccessToken(token) {
  const payload = parseToken(token, ACCESS_TOKEN_SECRET);
  if (payload.typ !== 'access') {
    throw new Error('Invalid access token');
  }
  return {
    sessionId: payload.sid,
    userId: payload.sub,
    tenantId: payload.tid,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
  };
}

function verifyRefreshToken(token) {
  const payload = parseToken(token, REFRESH_TOKEN_SECRET);
  if (payload.typ !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return {
    sessionId: payload.sid,
    userId: payload.sub,
    tenantId: payload.tid,
    tokenId: payload.jti,
  };
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function verifyRefreshTokenHash(token, storedHash) {
  if (typeof storedHash !== 'string' || storedHash.length === 0) {
    return false;
  }
  const incomingHash = hashRefreshToken(token);
  return safeEqualText(incomingHash, storedHash);
}

module.exports = {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
};
