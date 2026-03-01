const fs = require('fs');
const path = require('path');
const db = require('../../db');
const matchRepository = require('../repositories/matchRepository');
const {
  normalizeKind,
  listManifestRecords,
  upsertManifest,
  updateManifest,
  publishManifest,
} = require('../services/hubManifestService');

function parseStatuses(input) {
  if (Array.isArray(input)) {
    return input
      .flatMap((value) => String(value).split(','))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
  if (typeof input === 'string' && input.trim().length > 0) {
    return input
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
  return undefined;
}

function registerAdminRoutes(app, authenticate) {
  app.post('/admin/init', authenticate, async (req, res) => {
    if (!db.isConnected()) {
      return res.status(500).json({ error: { message: 'Database not connected' } });
    }

    try {
      const schemaPath = path.join(__dirname, '../../schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await db.query(schemaSql);
      return res.json({ message: 'Database initialized successfully' });
    } catch (err) {
      console.error('Init error:', err);
      return res.status(500).json({
        error: { message: 'Failed to initialize database', details: err.message },
      });
    }
  });

  app.post('/admin/teams', authenticate, async (req, res) => {
    try {
      const data = await matchRepository.upsertTeam(req.body || {});
      return res.json({ data });
    } catch (err) {
      const message = err?.message || 'Failed to upsert team';
      if (message.includes('required')) {
        return res.status(400).json({ error: { message } });
      }
      if (message.includes('Database not connected')) {
        return res.status(500).json({ error: { message } });
      }
      console.error('Team upsert error:', err);
      return res.status(500).json({ error: { message: 'Failed to upsert team' } });
    }
  });

  app.post('/admin/matches', authenticate, async (req, res) => {
    try {
      const data = await matchRepository.upsertMatch(req.body || {});
      return res.json({ data });
    } catch (err) {
      const message = err?.message || 'Failed to upsert match';
      if (message.includes('Missing required match fields')) {
        return res.status(400).json({ error: { message } });
      }
      if (message.includes('Database not connected')) {
        return res.status(500).json({ error: { message } });
      }
      console.error('Match upsert error:', err);
      return res.status(500).json({
        error: { message: 'Failed to upsert match', details: err.message },
      });
    }
  });

  app.put('/admin/matches/:id/score', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
      const data = await matchRepository.updateMatchScore(id, req.body || {});
      if (!data) {
        return res.status(404).json({ error: { message: 'Match not found' } });
      }
      return res.json({ data });
    } catch (err) {
      console.error('Match update error:', err);
      return res.status(500).json({ error: { message: 'Failed to update match' } });
    }
  });

  app.delete('/admin/matches/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
      const deleted = await matchRepository.deleteMatch(id);
      if (!deleted) {
        return res.status(404).json({ error: { message: 'Match not found' } });
      }
      return res.json({ message: 'Match deleted successfully' });
    } catch (err) {
      console.error('Match delete error:', err);
      return res.status(500).json({ error: { message: 'Failed to delete match' } });
    }
  });

  app.delete('/admin/teams/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
      const deleted = await matchRepository.deleteTeam(id);
      if (!deleted) {
        return res.status(404).json({ error: { message: 'Team not found' } });
      }
      return res.json({ message: 'Team deleted successfully' });
    } catch (err) {
      const message = err?.message || 'Failed to delete team';
      if (message.includes('mock mode')) {
        return res.status(400).json({ error: { message } });
      }
      console.error('Team delete error:', err);
      return res.status(500).json({
        error: { message: 'Failed to delete team. It might be referenced by existing matches.' },
      });
    }
  });

  app.get('/admin/extensions', authenticate, async (req, res) => {
    const kind = req.query.kind ? normalizeKind(req.query.kind) : undefined;
    const extensionId =
      typeof req.query.id === 'string' && req.query.id.trim().length > 0
        ? req.query.id.trim()
        : undefined;
    const channel =
      typeof req.query.channel === 'string' && req.query.channel.trim().length > 0
        ? req.query.channel.trim()
        : undefined;
    const statuses = parseStatuses(req.query.status || req.query.statuses);
    const limit =
      typeof req.query.limit === 'string' && req.query.limit.trim().length > 0
        ? Number(req.query.limit)
        : undefined;
    const offset =
      typeof req.query.offset === 'string' && req.query.offset.trim().length > 0
        ? Number(req.query.offset)
        : undefined;

    try {
      const data = await listManifestRecords({
        kind,
        extensionId,
        channel,
        statuses,
        limit,
        offset,
      });
      return res.json({ data, count: data.length });
    } catch (err) {
      console.error('List extension error:', err);
      return res.status(500).json({ error: { message: 'Failed to list extension manifests' } });
    }
  });

  app.post('/admin/extensions', authenticate, async (req, res) => {
    try {
      const data = await upsertManifest(req.body || {});
      return res.json({ data });
    } catch (err) {
      const message = err?.message || 'Failed to upsert extension manifest';
      return res.status(400).json({ error: { message } });
    }
  });

  app.put('/admin/extensions/:kind/:id/:version', authenticate, async (req, res) => {
    const kind = normalizeKind(req.params.kind);
    const extensionId = req.params.id;
    const version = req.params.version;
    const patch = req.body || {};

    try {
      const data = await updateManifest(kind, extensionId, version, patch);
      if (!data) {
        return res.status(404).json({ error: { message: 'Extension manifest not found' } });
      }
      return res.json({ data });
    } catch (err) {
      const message = err?.message || 'Failed to update extension manifest';
      return res.status(400).json({ error: { message } });
    }
  });

  app.post('/admin/extensions/publish', authenticate, async (req, res) => {
    const kind = normalizeKind(req.body?.kind);
    const extensionId = typeof req.body?.id === 'string' ? req.body.id : '';
    const version = typeof req.body?.version === 'string' ? req.body.version : '';

    if (!kind || !extensionId || !version) {
      return res.status(400).json({
        error: { message: 'kind, id, and version are required to publish extension manifest' },
      });
    }

    try {
      const data = await publishManifest(kind, extensionId, version);
      if (!data) {
        return res.status(404).json({ error: { message: 'Extension manifest not found' } });
      }
      return res.json({ data });
    } catch (err) {
      const message = err?.message || 'Failed to publish extension manifest';
      return res.status(400).json({ error: { message } });
    }
  });
}

module.exports = {
  registerAdminRoutes,
};

