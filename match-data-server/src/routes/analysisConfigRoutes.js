const matchRepository = require('../repositories/matchRepository');
const { withSourceMeta, buildAnalysisConfigPayload } = require('../services/planningService');
const { hasPermission, sanitizeMatchForPermissions } = require('../services/permissionService');

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function forbidden(res, message) {
  return res.status(403).json({
    error: {
      code: 'AUTH_FORBIDDEN',
      message,
    },
  });
}

function ensureFundamentalDataAccess(req, res) {
  if (hasPermission(req.authContext, 'datasource:use:fundamental')) {
    return true;
  }
  forbidden(res, 'Missing datasource permission: datasource:use:fundamental');
  return false;
}

function registerAnalysisConfigRoutes(app, authenticate) {
  app.get('/analysis/config/match/:id', authenticate, async (req, res) => {
    if (!ensureFundamentalDataAccess(req, res)) {
      return;
    }

    const { id } = req.params;

    try {
      const snapshot = await matchRepository.getMatchById(id);
      if (!snapshot) {
        return res.status(404).json({ error: { message: 'Match not found' } });
      }

      const visibleMatch = sanitizeMatchForPermissions(snapshot.match, req.authContext);
      if (!visibleMatch) {
        return forbidden(res, 'Match is not accessible for current datasource permissions');
      }

      const enriched = withSourceMeta(visibleMatch, snapshot.source);
      const config = await buildAnalysisConfigPayload(enriched, req);
      return res.json({
        data: {
          matchId: id,
          ...config,
        },
      });
    } catch (err) {
      console.error('Analysis config error:', err);
      return res.status(500).json({ error: { message: 'Failed to resolve analysis config' } });
    }
  });

  app.post('/analysis/config/resolve', authenticate, async (req, res) => {
    if (!ensureFundamentalDataAccess(req, res)) {
      return;
    }

    const body = req.body;
    if (!isPlainObject(body)) {
      return res.status(400).json({ error: { message: 'Request body must be an object' } });
    }

    const rawMatch = body.match || body.matchData || body.data || body;
    if (!isPlainObject(rawMatch)) {
      return res.status(400).json({ error: { message: 'Missing match snapshot in request body' } });
    }

    const mergedMatch = { ...rawMatch };
    const mergedSourceContext = {
      ...(isPlainObject(rawMatch.sourceContext) ? rawMatch.sourceContext : {}),
      ...(isPlainObject(body.sourceContext) ? body.sourceContext : {}),
    };

    if (isPlainObject(body.selectedSources)) {
      mergedSourceContext.selectedSources = {
        ...(isPlainObject(mergedSourceContext.selectedSources)
          ? mergedSourceContext.selectedSources
          : {}),
        ...body.selectedSources,
      };
    }

    if (Array.isArray(body.selectedSourceIds)) {
      mergedSourceContext.selectedSourceIds = body.selectedSourceIds;
    }

    if (isPlainObject(body.capabilities)) {
      mergedSourceContext.capabilities = {
        ...(isPlainObject(mergedSourceContext.capabilities) ? mergedSourceContext.capabilities : {}),
        ...body.capabilities,
      };
    }

    if (Object.keys(mergedSourceContext).length > 0) {
      mergedMatch.sourceContext = mergedSourceContext;
    }

    try {
      const visibleMatch = sanitizeMatchForPermissions(mergedMatch, req.authContext);
      if (!visibleMatch) {
        return forbidden(res, 'Match is not accessible for current datasource permissions');
      }

      const config = await buildAnalysisConfigPayload(visibleMatch, req);
      const data = { ...config };
      if (typeof visibleMatch.id === 'string' && visibleMatch.id.trim().length > 0) {
        data.matchId = visibleMatch.id.trim();
      }
      return res.json({ data });
    } catch (err) {
      console.error('Resolve analysis config error:', err);
      return res.status(500).json({ error: { message: 'Failed to resolve analysis config' } });
    }
  });
}

module.exports = {
  registerAnalysisConfigRoutes,
};
