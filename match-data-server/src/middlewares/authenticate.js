function parseBearerToken(authHeader) {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function unauthorized(res, message, code = 'AUTH_UNAUTHORIZED') {
  return res.status(401).json({
    error: {
      code,
      message,
    },
  });
}

function createAuthenticateMiddleware(options) {
  const resolvedOptions =
    typeof options === 'string'
      ? { apiKey: options, authService: null }
      : { apiKey: options?.apiKey, authService: options?.authService };

  return async (req, res, next) => {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      return unauthorized(res, 'Missing or invalid authorization header');
    }

    if (resolvedOptions.apiKey && token === resolvedOptions.apiKey) {
      req.authContext = {
        mode: 'legacy',
        source: 'api_key',
        userId: null,
        tenantId: null,
        sessionId: null,
        roles: ['legacy_client'],
        permissions: ['legacy:*'],
      };
      return next();
    }

    if (!resolvedOptions.authService) {
      return unauthorized(res, 'Invalid API Key or access token');
    }

    try {
      req.authContext = await resolvedOptions.authService.authenticateAccessToken(token);
      return next();
    } catch (error) {
      return unauthorized(
        res,
        error.message || 'Invalid or expired access token',
        error.code || 'AUTH_INVALID_ACCESS',
      );
    }
  };
}

function createRequireUserAuthMiddleware(authService) {
  return async (req, res, next) => {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      return unauthorized(res, 'Missing or invalid authorization header');
    }

    try {
      req.authContext = await authService.authenticateAccessToken(token);
      return next();
    } catch (error) {
      return unauthorized(
        res,
        error.message || 'Invalid or expired access token',
        error.code || 'AUTH_INVALID_ACCESS',
      );
    }
  };
}

module.exports = {
  parseBearerToken,
  createAuthenticateMiddleware,
  createRequireUserAuthMiddleware,
};
