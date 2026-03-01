const { getManifest } = require('../services/hubManifestService');

async function sendHubManifest(kind, req, res) {
  const version = Array.isArray(req.query.version) ? req.query.version[0] : req.query.version;
  const channel = Array.isArray(req.query.channel) ? req.query.channel[0] : req.query.channel;

  try {
    const record = await getManifest(kind, req.params.id, {
      version,
      channel: channel || 'stable',
      statuses: ['published'],
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
  ['agent', 'skill', 'template'].forEach((kind) => {
    const plural = `${kind}s`;
    const paths = [
      `/hub/${plural}/:id`,
      `/hub/${kind}/:id`,
      `/extensions/${plural}/:id`,
      `/extensions/${kind}/:id`,
    ];

    paths.forEach((routePath) => {
      app.get(routePath, authenticate, (req, res) => sendHubManifest(kind, req, res));
    });
  });
}

module.exports = {
  registerHubRoutes,
};

