const matchRepository = require('../repositories/matchRepository');
const { withAnalysisConfig } = require('../services/planningService');
const { hasPermission, sanitizeMatchForPermissions } = require('../services/permissionService');

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

function registerMatchRoutes(app, authenticate) {
  app.get('/matches', authenticate, async (req, res) => {
    if (!ensureFundamentalDataAccess(req, res)) {
      return;
    }

    const { date, status, search, domainId, limit = 50, offset = 0 } = req.query;

    try {
      const result = await matchRepository.listMatches({
        date,
        status,
        search,
        domainId,
        limit,
        offset,
      });
      const visibleMatches = result.data
        .map((match) => sanitizeMatchForPermissions(match, req.authContext))
        .filter((match) => !!match);
      const data = await Promise.all(
        visibleMatches.map((match) => withAnalysisConfig(match, result.source, req)),
      );

      return res.json({
        data,
        pagination: result.pagination,
      });
    } catch (err) {
      console.error('Match list error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  });

  app.get('/matches/live', authenticate, async (req, res) => {
    if (!ensureFundamentalDataAccess(req, res)) {
      return;
    }

    try {
      const result = await matchRepository.listLiveMatches();
      const visibleMatches = result.data
        .map((match) => sanitizeMatchForPermissions(match, req.authContext))
        .filter((match) => !!match);
      const data = await Promise.all(
        visibleMatches.map((match) => withAnalysisConfig(match, result.source, req)),
      );
      return res.json({ data, count: result.count });
    } catch (err) {
      console.error('Live match error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  });

  app.get('/teams', authenticate, async (req, res) => {
    if (!ensureFundamentalDataAccess(req, res)) {
      return;
    }

    const { search, limit = 50, offset = 0 } = req.query;
    try {
      const result = await matchRepository.listTeams({ search, limit, offset });
      return res.json(result);
    } catch (err) {
      console.error('Team list error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  });

  app.get('/leagues', authenticate, async (req, res) => {
    if (!ensureFundamentalDataAccess(req, res)) {
      return;
    }

    try {
      const data = await matchRepository.listLeagues();
      return res.json({ data });
    } catch (err) {
      console.error('League list error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  });

  app.get('/teams/:id/matches', authenticate, async (req, res) => {
    if (!ensureFundamentalDataAccess(req, res)) {
      return;
    }

    const { id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    try {
      const result = await matchRepository.listTeamMatches(id, { limit, offset });
      const visibleMatches = result.data
        .map((match) => sanitizeMatchForPermissions(match, req.authContext))
        .filter((match) => !!match);
      const data = await Promise.all(
        visibleMatches.map((match) => withAnalysisConfig(match, result.source, req)),
      );
      return res.json({
        data,
        pagination: result.pagination,
      });
    } catch (err) {
      console.error('Team match list error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  });

  app.get('/matches/:id', authenticate, async (req, res) => {
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

      const data = await withAnalysisConfig(visibleMatch, snapshot.source, req);
      return res.json({ data });
    } catch (err) {
      console.error('Match detail error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  });
}

module.exports = {
  registerMatchRoutes,
};
