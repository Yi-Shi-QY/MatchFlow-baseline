const matchRepository = require('../repositories/matchRepository');
const { withAnalysisConfig } = require('../services/planningService');

function registerMatchRoutes(app, authenticate) {
  app.get('/matches', authenticate, async (req, res) => {
    const { date, status, search, limit = 50, offset = 0 } = req.query;

    try {
      const result = await matchRepository.listMatches({
        date,
        status,
        search,
        limit,
        offset,
      });
      const data = await Promise.all(
        result.data.map((match) => withAnalysisConfig(match, result.source, req)),
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
    try {
      const result = await matchRepository.listLiveMatches();
      const data = await Promise.all(
        result.data.map((match) => withAnalysisConfig(match, result.source, req)),
      );
      return res.json({ data, count: result.count });
    } catch (err) {
      console.error('Live match error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  });

  app.get('/teams', authenticate, async (req, res) => {
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
    try {
      const data = await matchRepository.listLeagues();
      return res.json({ data });
    } catch (err) {
      console.error('League list error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  });

  app.get('/teams/:id/matches', authenticate, async (req, res) => {
    const { id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    try {
      const result = await matchRepository.listTeamMatches(id, { limit, offset });
      const data = await Promise.all(
        result.data.map((match) => withAnalysisConfig(match, result.source, req)),
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
    const { id } = req.params;

    try {
      const snapshot = await matchRepository.getMatchById(id);
      if (!snapshot) {
        return res.status(404).json({ error: { message: 'Match not found' } });
      }

      const data = await withAnalysisConfig(snapshot.match, snapshot.source, req);
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

