const { createRequireUserAuthMiddleware } = require('../middlewares/authenticate');
const { AuthError } = require('../services/authService');

function extractClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function extractUserAgent(req) {
  const header = req.headers['user-agent'];
  return typeof header === 'string' && header.trim().length > 0 ? header.trim() : null;
}

function resolveLoginIdentifier(body) {
  if (!body || typeof body !== 'object') {
    return '';
  }

  const candidates = [body.identifier, body.username, body.email];
  const selected = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return selected ? selected.trim() : '';
}

function handleAuthError(res, error, fallbackMessage) {
  const statusCode = error?.statusCode || 500;
  const code = error?.code || 'AUTH_INTERNAL_ERROR';
  const message = error?.message || fallbackMessage;

  if (!(error instanceof AuthError) && statusCode >= 500) {
    console.error('[auth]', fallbackMessage, error);
  }

  return res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}

function registerAuthRoutes(app, { authService }) {
  const requireUserAuth = createRequireUserAuthMiddleware(authService);

  app.post('/auth/login', async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        error: {
          code: 'AUTH_INVALID_REQUEST',
          message: 'Request body must be an object',
        },
      });
    }

    try {
      const data = await authService.login({
        identifier: resolveLoginIdentifier(body),
        password: body.password,
        ipAddress: extractClientIp(req),
        userAgent: extractUserAgent(req),
      });
      return res.json({ data });
    } catch (error) {
      return handleAuthError(res, error, 'Failed to login');
    }
  });

  app.post('/auth/refresh', async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        error: {
          code: 'AUTH_INVALID_REQUEST',
          message: 'Request body must be an object',
        },
      });
    }

    try {
      const data = await authService.refresh({
        refreshToken: body.refreshToken,
        ipAddress: extractClientIp(req),
        userAgent: extractUserAgent(req),
      });
      return res.json({ data });
    } catch (error) {
      return handleAuthError(res, error, 'Failed to refresh token');
    }
  });

  app.post('/auth/logout', requireUserAuth, async (req, res) => {
    const refreshToken =
      req.body && typeof req.body === 'object' ? req.body.refreshToken : undefined;

    try {
      await authService.logout({
        sessionId: req.authContext?.sessionId,
        refreshToken,
      });
      return res.json({ message: 'Logged out successfully' });
    } catch (error) {
      return handleAuthError(res, error, 'Failed to logout');
    }
  });

  app.get('/auth/me', requireUserAuth, async (req, res) => {
    try {
      const data = await authService.getCurrentUser(req.authContext);
      return res.json({ data });
    } catch (error) {
      return handleAuthError(res, error, 'Failed to get current user');
    }
  });

  app.get('/capabilities/me', requireUserAuth, async (req, res) => {
    try {
      const data = await authService.getCapabilities(req.authContext);
      return res.json({ data });
    } catch (error) {
      return handleAuthError(res, error, 'Failed to get user capabilities');
    }
  });
}

module.exports = {
  registerAuthRoutes,
};
