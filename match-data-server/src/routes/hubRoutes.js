const { getManifest } = require('../services/hubManifestService');
const { canAccessHubManifest } = require('../services/permissionService');

function forbidden(res, message) {
  return res.status(403).json({
    error: {
      code: 'AUTH_FORBIDDEN',
      message,
    },
  });
}

async function sendHubManifest(kind, req, res) {
  const extensionId = req.params.id;
  if (!canAccessHubManifest(req.authContext, kind, extensionId)) {
    return forbidden(res, `Missing permission to access ${kind} manifest: ${extensionId}`);
  }

  const version = Array.isArray(req.query.version) ? req.query.version[0] : req.query.version;
  const channel = Array.isArray(req.query.channel) ? req.query.channel[0] : req.query.channel;

  try {
    const record = await getManifest(kind, extensionId, {
      version,
      channel: channel || 'stable',
      statuses: ['published'],
      tenantId: req.authContext?.tenantId,
    });
    if (!record) {
      return res.status(404).json({ error: { message: `${kind} manifest not found` } });
    }
    return res.json({ data: record.manifest });
  } catch (err) {
    console.error('Hub manifest error:', err);
    return res.status(500).json({ error: { message: 'Failed to read hub manifest' } });
  }
}

function registerHubRoutes(app, authenticate) {
  ['agent', 'skill', 'template', 'domain'].forEach((kind) => {
    const plural = `${kind}s`;
    const paths = [
      `/hub/${plural}/:id`,
      `/hub/${kind}/:id`,
      `/extensions/${plural}/:id`,
      `/extensions/${kind}/:id`,
    ];
    if (kind === 'domain') {
      paths.push('/domains/:id');
    }

    paths.forEach((routePath) => {
      app.get(routePath, authenticate, (req, res) => sendHubManifest(kind, req, res));
    });
  });
}

module.exports = {
  registerHubRoutes,
};
