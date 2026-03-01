require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'your-secret-key';

app.use(cors());
app.use(express.json());

// Mock Data (Fallback)
const MOCK_MATCHES = [
  {
    id: 'm1',
    league: 'Premier League',
    date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    status: 'upcoming',
    homeTeam: { id: 'h1', name: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png', form: ['W', 'W', 'W', 'W', 'W'] },
    awayTeam: { id: 'a1', name: 'Chelsea', logo: 'https://media.api-sports.io/football/teams/49.png', form: ['L', 'D', 'W', 'L', 'D'] },
    stats: { possession: { home: 55, away: 45 }, shots: { home: 12, away: 8 }, shotsOnTarget: { home: 5, away: 3 } },
    odds: { had: { h: 1.8, d: 3.5, a: 4.2 }, hhad: { h: 3.2, d: 3.4, a: 2.1, goalline: -1 } }
  },
  {
    id: 'm2',
    league: 'La Liga',
    date: new Date().toISOString(), // Today
    status: 'live',
    homeTeam: { id: 'h2', name: 'Real Madrid', logo: 'https://media.api-sports.io/football/teams/541.png', form: ['W', 'D', 'W', 'W', 'L'] },
    awayTeam: { id: 'a2', name: 'Barcelona', logo: 'https://media.api-sports.io/football/teams/529.png', form: ['W', 'W', 'W', 'W', 'W'] },
    score: { home: 1, away: 1 },
    stats: { possession: { home: 48, away: 52 }, shots: { home: 15, away: 14 }, shotsOnTarget: { home: 6, away: 7 } },
    odds: { had: { h: 2.1, d: 3.3, a: 3.1 }, hhad: { h: 4.0, d: 3.8, a: 1.7, goalline: -1 } }
  },
  {
    id: 'm3',
    league: 'Serie A',
    date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    status: 'finished',
    homeTeam: { id: 'h3', name: 'Juventus', logo: 'https://media.api-sports.io/football/teams/496.png', form: ['D', 'D', 'W', 'L', 'W'] },
    awayTeam: { id: 'a3', name: 'AC Milan', logo: 'https://media.api-sports.io/football/teams/489.png', form: ['W', 'L', 'W', 'W', 'D'] },
    score: { home: 2, away: 0 },
    stats: { possession: { home: 40, away: 60 }, shots: { home: 8, away: 18 }, shotsOnTarget: { home: 4, away: 5 } },
    odds: { had: { h: 1.9, d: 3.2, a: 3.8 }, hhad: { h: 3.5, d: 3.3, a: 1.9, goalline: -1 } }
  }
];

function buildCapabilities(match) {
  const hasStats = !!match?.stats && typeof match.stats === 'object' && Object.keys(match.stats).length > 0;
  const hasOdds = !!match?.odds && typeof match.odds === 'object' && Object.keys(match.odds).length > 0;
  const hasCustom = typeof match?.customInfo === 'string'
    ? match.customInfo.trim().length > 0
    : match?.customInfo != null;

  return { hasStats, hasOdds, hasCustom };
}

function withSourceMeta(match, source) {
  return {
    ...match,
    source,
    capabilities: buildCapabilities(match)
  };
}

function hasNonEmptyObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function parseBooleanEnv(value, fallback) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeStringArray(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

function uniqueStrings(values) {
  return Array.from(new Set(normalizeStringArray(values)));
}

function compareSemver(a, b) {
  const parse = (value) => {
    const [core, pre = ''] = String(value || '').split('-', 2);
    const [major, minor, patch] = core.split('.').map(n => Number(n) || 0);
    return { major, minor, patch, pre };
  };

  const av = parse(a);
  const bv = parse(b);

  if (av.major !== bv.major) return av.major > bv.major ? 1 : -1;
  if (av.minor !== bv.minor) return av.minor > bv.minor ? 1 : -1;
  if (av.patch !== bv.patch) return av.patch > bv.patch ? 1 : -1;
  if (av.pre === bv.pre) return 0;
  if (!av.pre) return 1;
  if (!bv.pre) return -1;
  return av.pre > bv.pre ? 1 : -1;
}

const HUB_MANIFESTS = {
  agent: {
    momentum_agent: [
      {
        kind: 'agent',
        id: 'momentum_agent',
        version: '1.0.0',
        name: 'Momentum Agent',
        description: 'Analyzes momentum swings for live matches using stats and market signals.',
        updatedAt: '2026-03-01T00:00:00.000Z',
        rolePrompt: {
          en: 'You are a momentum analyst. Track pressure swings, rhythm changes, and turning points.',
          zh: 'Use concise Chinese analysis tone when user language is Chinese.'
        },
        skills: ['calculator'],
        contextDependencies: ['overview', 'odds', 'stats']
      }
    ]
  },
  skill: {
    select_plan_template_v2: [
      {
        kind: 'skill',
        id: 'select_plan_template_v2',
        version: '1.0.0',
        name: 'Template Selector V2',
        description: 'Alias skill that reuses built-in template selector.',
        updatedAt: '2026-03-01T00:00:00.000Z',
        declaration: {
          name: 'select_plan_template_v2',
          description: 'Select analysis template by source profile.',
          parameters: {
            type: 'object',
            properties: {
              templateType: { type: 'string', description: 'Template type or identifier.' },
              language: { type: 'string', enum: ['en', 'zh'] },
              includeAnimations: { type: 'boolean' }
            },
            required: ['templateType']
          }
        },
        runtime: {
          mode: 'builtin_alias',
          targetSkill: 'select_plan_template'
        }
      }
    ]
  },
  template: {
    live_market_pro: [
      {
        kind: 'template',
        id: 'live_market_pro',
        version: '1.0.0',
        name: 'Live Market Pro',
        description: 'Live match workflow with momentum and odds reaction focus.',
        updatedAt: '2026-03-01T00:00:00.000Z',
        rule: 'Use for live matches with both rich stats and odds updates.',
        requiredAgents: ['overview', 'odds', 'momentum_agent', 'prediction'],
        requiredSkills: ['select_plan_template_v2'],
        segments: [
          {
            title: { en: 'Live Overview', zh: 'Sai Shi Gai Kuang' },
            focus: { en: 'Summarize game state and key turning points.', zh: 'Zongjie dangqian ju shi he guanjian zhuan zhe' },
            animationType: 'scoreboard',
            agentType: 'overview',
            contextMode: 'independent'
          },
          {
            title: { en: 'Momentum Lens', zh: 'Jie Zou Dong Liang' },
            focus: { en: 'Track pressure waves and control shifts.', zh: 'Genzong yali bo dong yu kongzhi zhuanyi' },
            animationType: 'heatmap',
            agentType: 'momentum_agent',
            contextMode: 'build_upon'
          },
          {
            title: { en: 'Market Reaction', zh: 'Pan Kou Fan Ying' },
            focus: { en: 'Interpret implied probability movement from odds.', zh: 'Jieshi pei lv yinhan gai lv de bianhua' },
            animationType: 'odds_shift',
            agentType: 'odds',
            contextMode: 'build_upon'
          },
          {
            title: { en: 'Final Projection', zh: 'Zui Zhong Yu Ce' },
            focus: { en: 'Provide final probabilities and risk notes.', zh: 'Geichu jieguo gailv yu fengxian tishi' },
            animationType: 'none',
            agentType: 'prediction',
            contextMode: 'all'
          }
        ]
      }
    ]
  }
};

function getHubManifest(kind, id, version) {
  const kindBucket = HUB_MANIFESTS[kind];
  if (!kindBucket) return null;

  const normalizedId = typeof id === 'string' ? id.trim() : '';
  if (!normalizedId) return null;

  const versions = kindBucket[normalizedId];
  if (!Array.isArray(versions) || versions.length === 0) return null;

  const normalizedVersion = typeof version === 'string' ? version.trim() : '';
  if (normalizedVersion) {
    return versions.find(item => item.version === normalizedVersion) || null;
  }

  return versions.reduce((best, current) => {
    if (!best) return current;
    return compareSemver(current.version, best.version) > 0 ? current : best;
  }, null);
}

function buildDefaultHubBaseUrl(req) {
  const envBase = typeof process.env.HUB_BASE_URL === 'string' ? process.env.HUB_BASE_URL.trim() : '';
  if (envBase) return envBase.replace(/\/+$/, '');
  if (!req) return '';
  return `${req.protocol}://${req.get('host')}`.replace(/\/+$/, '');
}

function resolveHubHint(req, overrideHub) {
  const fallbackAutoInstall = parseBooleanEnv(process.env.HUB_AUTO_INSTALL, true);
  const includeApiKeyByDefault = parseBooleanEnv(process.env.HUB_INCLUDE_API_KEY_HINT, false);
  const envApiKeyHint = typeof process.env.HUB_API_KEY_HINT === 'string' && process.env.HUB_API_KEY_HINT.trim().length > 0
    ? process.env.HUB_API_KEY_HINT.trim()
    : undefined;

  const baseUrl = typeof overrideHub?.baseUrl === 'string' && overrideHub.baseUrl.trim().length > 0
    ? overrideHub.baseUrl.trim().replace(/\/+$/, '')
    : buildDefaultHubBaseUrl(req);
  const autoInstall = typeof overrideHub?.autoInstall === 'boolean'
    ? overrideHub.autoInstall
    : fallbackAutoInstall;
  const apiKey = typeof overrideHub?.apiKey === 'string' && overrideHub.apiKey.trim().length > 0
    ? overrideHub.apiKey.trim()
    : (envApiKeyHint || (includeApiKeyByDefault ? API_KEY : undefined));

  const hint = { baseUrl, autoInstall };
  if (apiKey) {
    hint.apiKey = apiKey;
  }
  return hint;
}

function deriveSourceSignals(matchData) {
  const selected = matchData?.sourceContext?.selectedSources;
  const selectedIds = Array.isArray(matchData?.sourceContext?.selectedSourceIds)
    ? new Set(matchData.sourceContext.selectedSourceIds.filter(id => typeof id === 'string'))
    : new Set();
  const sourceCapabilities = matchData?.sourceContext?.capabilities || matchData?.capabilities || {};

  const hasStats = typeof sourceCapabilities.hasStats === 'boolean'
    ? sourceCapabilities.hasStats
    : hasNonEmptyObject(matchData?.stats);
  const hasOdds = typeof sourceCapabilities.hasOdds === 'boolean'
    ? sourceCapabilities.hasOdds
    : hasNonEmptyObject(matchData?.odds);
  const hasCustom = typeof sourceCapabilities.hasCustom === 'boolean'
    ? sourceCapabilities.hasCustom
    : (typeof matchData?.customInfo === 'string'
      ? matchData.customInfo.trim().length > 0
      : matchData?.customInfo != null);
  const hasFundamental = typeof sourceCapabilities.hasFundamental === 'boolean'
    ? sourceCapabilities.hasFundamental
    : true;

  const wantsFundamental = typeof selected?.fundamental === 'boolean'
    ? selected.fundamental
    : (selectedIds.has('fundamental') ? true : hasFundamental);
  const wantsMarket = typeof selected?.market === 'boolean'
    ? selected.market
    : (selectedIds.has('market') ? true : hasOdds);
  const wantsCustom = typeof selected?.custom === 'boolean'
    ? selected.custom
    : (selectedIds.has('custom') ? true : hasCustom);

  const status = typeof matchData?.status === 'string'
    ? matchData.status.toLowerCase()
    : (typeof matchData?.sourceContext?.matchStatus === 'string'
      ? matchData.sourceContext.matchStatus.toLowerCase()
      : 'unknown');

  return {
    wantsFundamental,
    wantsMarket,
    wantsCustom,
    hasStats,
    hasOdds,
    hasCustom,
    status
  };
}

function getTemplateRequirements(templateId) {
  const manifest = getHubManifest('template', templateId);
  if (!manifest) {
    return { requiredAgents: [], requiredSkills: [] };
  }
  return {
    requiredAgents: normalizeStringArray(manifest.requiredAgents),
    requiredSkills: normalizeStringArray(manifest.requiredSkills)
  };
}

function recommendPlanning(matchData, req) {
  const planningInput = matchData?.sourceContext?.planning || matchData?.analysisConfig?.planning || {};
  const overrideHub = planningInput?.hub && typeof planningInput.hub === 'object' ? planningInput.hub : undefined;
  const hub = resolveHubHint(req, overrideHub);

  const inputRequiredAgents = normalizeStringArray(planningInput?.requiredAgents);
  const inputRequiredSkills = normalizeStringArray(planningInput?.requiredSkills);

  const forcedMode = planningInput?.mode === 'autonomous' || planningInput?.mode === 'template'
    ? planningInput.mode
    : null;
  const forcedTemplateId = typeof planningInput?.templateId === 'string' && planningInput.templateId.trim().length > 0
    ? planningInput.templateId.trim()
    : (typeof planningInput?.templateType === 'string' && planningInput.templateType.trim().length > 0
      ? planningInput.templateType.trim()
      : null);

  if (forcedMode === 'autonomous' && !forcedTemplateId) {
    return {
      mode: 'autonomous',
      requiredAgents: uniqueStrings(inputRequiredAgents),
      requiredSkills: uniqueStrings(inputRequiredSkills),
      hub,
      reason: 'forced_autonomous'
    };
  }

  if (forcedTemplateId) {
    const templateRequirements = getTemplateRequirements(forcedTemplateId);
    return {
      mode: 'template',
      templateId: forcedTemplateId,
      requiredAgents: uniqueStrings([...templateRequirements.requiredAgents, ...inputRequiredAgents]),
      requiredSkills: uniqueStrings([...templateRequirements.requiredSkills, ...inputRequiredSkills]),
      hub,
      reason: 'forced_template'
    };
  }

  const signals = deriveSourceSignals(matchData);

  if (signals.wantsCustom && !signals.wantsFundamental && !signals.wantsMarket) {
    return {
      mode: 'autonomous',
      requiredAgents: uniqueStrings(inputRequiredAgents),
      requiredSkills: uniqueStrings(inputRequiredSkills),
      hub,
      reason: 'custom_only'
    };
  }

  let templateId = 'basic';
  let reason = 'minimal_data';

  if (signals.status === 'live' && signals.hasStats && signals.hasOdds) {
    templateId = 'live_market_pro';
    reason = 'live_stats_odds';
  } else if (signals.wantsMarket && !signals.wantsFundamental) {
    templateId = 'odds_focused';
    reason = 'market_only';
  } else if (signals.hasStats && signals.hasOdds) {
    templateId = 'comprehensive';
    reason = 'stats_and_odds';
  } else if (signals.hasOdds && !signals.hasStats) {
    templateId = 'odds_focused';
    reason = 'odds_without_stats';
  } else if (signals.hasStats) {
    templateId = 'standard';
    reason = signals.status === 'live' ? 'live_stats' : 'stats_only';
  }

  const templateRequirements = getTemplateRequirements(templateId);
  return {
    mode: 'template',
    templateId,
    requiredAgents: uniqueStrings([...templateRequirements.requiredAgents, ...inputRequiredAgents]),
    requiredSkills: uniqueStrings([...templateRequirements.requiredSkills, ...inputRequiredSkills]),
    hub,
    reason
  };
}

function buildAnalysisConfigPayload(matchData, req) {
  const planning = recommendPlanning(matchData, req);
  const signals = deriveSourceSignals(matchData);
  const selectedSources = {
    fundamental: signals.wantsFundamental,
    market: signals.wantsMarket,
    custom: signals.wantsCustom
  };
  const selectedSourceIds = Object.entries(selectedSources)
    .filter(([, enabled]) => !!enabled)
    .map(([sourceId]) => sourceId);

  return {
    sourceContext: {
      selectedSources,
      selectedSourceIds,
      capabilities: {
        hasFundamental: signals.wantsFundamental,
        hasStats: signals.hasStats,
        hasOdds: signals.hasOdds,
        hasCustom: signals.hasCustom
      },
      matchStatus: signals.status,
      planning
    }
  };
}

function withAnalysisConfig(match, source, req) {
  const enriched = withSourceMeta(match, source);
  return {
    ...enriched,
    analysisConfig: {
      planning: recommendPlanning(enriched, req)
    }
  };
}

function mapDbRowToMatch(row) {
  const homeTeam = row?.homeTeam || row?.hometeam || {};
  const awayTeam = row?.awayTeam || row?.awayteam || {};

  return {
    id: row.id,
    league: row.league_name,
    date: row.match_date,
    status: row.status,
    score: { home: row.home_score, away: row.away_score },
    stats: row.match_stats,
    odds: row.odds,
    homeTeam: {
      id: homeTeam.id,
      name: homeTeam.name,
      logo: homeTeam.logo_url,
      form: homeTeam.recent_form
    },
    awayTeam: {
      id: awayTeam.id,
      name: awayTeam.name,
      logo: awayTeam.logo_url,
      form: awayTeam.recent_form
    }
  };
}

async function getMatchSnapshotById(id) {
  if (db.isConnected()) {
    const query = `
      SELECT m.*, 
             row_to_json(ht.*) as homeTeam, 
             row_to_json(at.*) as awayTeam 
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.id = $1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }
    return {
      match: mapDbRowToMatch(result.rows[0]),
      source: 'server-db'
    };
  }

  const match = MOCK_MATCHES.find(item => item.id === id);
  if (!match) {
    return null;
  }

  return { match, source: 'server-mock' };
}

// Authentication Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Missing or invalid authorization header' } });
  }

  const token = authHeader.split(' ')[1];
  if (token !== API_KEY) {
    return res.status(401).json({ error: { message: 'Invalid API Key' } });
  }

  next();
};

// --- Routes ---

// 1. Get Matches (Public/Protected depending on requirement, here protected)
app.get('/matches', authenticate, async (req, res) => {
  const { date, status, search, limit = 50, offset = 0 } = req.query;

  // Use DB if connected
  if (db.isConnected()) {
    try {
      let query = `
        SELECT m.*, 
               row_to_json(ht.*) as homeTeam, 
               row_to_json(at.*) as awayTeam 
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND m.status = $${params.length}`;
      }
      
      if (date) {
        params.push(date);
        query += ` AND DATE(m.match_date) = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (ht.name ILIKE $${params.length} OR at.name ILIKE $${params.length} OR m.league_name ILIKE $${params.length})`;
      }

      query += ` ORDER BY m.match_date ASC`;
      
      // Add pagination
      params.push(parseInt(limit, 10));
      query += ` LIMIT $${params.length}`;
      
      params.push(parseInt(offset, 10));
      query += ` OFFSET $${params.length}`;

      const result = await db.query(query, params);
      
      const formatted = result.rows.map(row => withAnalysisConfig(mapDbRowToMatch(row), 'server-db', req));
      
      return res.json({ data: formatted, pagination: { limit: parseInt(limit, 10), offset: parseInt(offset, 10), count: formatted.length } });
    } catch (err) {
      console.error('DB Error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  }

  // Fallback to Mock Data
  let filtered = [...MOCK_MATCHES];

  if (status) {
    filtered = filtered.filter(m => m.status === status);
  }

  if (date) {
    filtered = filtered.filter(m => m.date.startsWith(date));
  }
  
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(m => 
      m.homeTeam.name.toLowerCase().includes(s) || 
      m.awayTeam.name.toLowerCase().includes(s) || 
      m.league.toLowerCase().includes(s)
    );
  }

  const paginated = filtered
    .slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10))
    .map(match => withAnalysisConfig(match, 'server-mock', req));

  res.json({ data: paginated, pagination: { limit: parseInt(limit, 10), offset: parseInt(offset, 10), count: paginated.length, total: filtered.length } });
});

// 1.2 Get Live Matches
app.get('/matches/live', authenticate, async (req, res) => {
  if (db.isConnected()) {
    try {
      const query = `
        SELECT m.*, 
               row_to_json(ht.*) as homeTeam, 
               row_to_json(at.*) as awayTeam 
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        WHERE m.status = 'live'
        ORDER BY m.match_date DESC
      `;
      const result = await db.query(query);
      
      const formatted = result.rows.map(row => withAnalysisConfig(mapDbRowToMatch(row), 'server-db', req));
      
      return res.json({ data: formatted, count: formatted.length });
    } catch (err) {
      console.error('DB Error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  }

  // Fallback to Mock Data
  const liveMatches = MOCK_MATCHES
    .filter(m => m.status === 'live')
    .map(match => withAnalysisConfig(match, 'server-mock', req));
  res.json({ data: liveMatches, count: liveMatches.length });
});

// 1.5 Get Teams
app.get('/teams', authenticate, async (req, res) => {
  const { search, limit = 50, offset = 0 } = req.query;

  if (db.isConnected()) {
    try {
      let query = `SELECT * FROM teams WHERE 1=1`;
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        query += ` AND name ILIKE $${params.length}`;
      }

      query += ` ORDER BY name ASC`;
      
      params.push(parseInt(limit, 10));
      query += ` LIMIT $${params.length}`;
      
      params.push(parseInt(offset, 10));
      query += ` OFFSET $${params.length}`;

      const result = await db.query(query, params);
      return res.json({ data: result.rows, pagination: { limit: parseInt(limit, 10), offset: parseInt(offset, 10), count: result.rows.length } });
    } catch (err) {
      console.error('DB Error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  }

  // Fallback to Mock Data
  let teams = [];
  const teamMap = new Map();
  MOCK_MATCHES.forEach(m => {
    if (!teamMap.has(m.homeTeam.id)) teamMap.set(m.homeTeam.id, m.homeTeam);
    if (!teamMap.has(m.awayTeam.id)) teamMap.set(m.awayTeam.id, m.awayTeam);
  });
  teams = Array.from(teamMap.values());

  if (search) {
    const s = search.toLowerCase();
    teams = teams.filter(t => t.name.toLowerCase().includes(s));
  }

  const paginated = teams.slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10));
  res.json({ data: paginated, pagination: { limit: parseInt(limit, 10), offset: parseInt(offset, 10), count: paginated.length, total: teams.length } });
});

// 1.8 Get Leagues
app.get('/leagues', authenticate, async (req, res) => {
  if (db.isConnected()) {
    try {
      const query = `SELECT DISTINCT league_name FROM matches ORDER BY league_name ASC`;
      const result = await db.query(query);
      return res.json({ data: result.rows.map(r => r.league_name) });
    } catch (err) {
      console.error('DB Error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  }

  // Fallback to Mock Data
  const leagues = [...new Set(MOCK_MATCHES.map(m => m.league))];
  res.json({ data: leagues.sort() });
});

// 1.9 Get Matches for a Team
app.get('/teams/:id/matches', authenticate, async (req, res) => {
  const { id } = req.params;
  const { limit = 10, offset = 0 } = req.query;

  if (db.isConnected()) {
    try {
      const query = `
        SELECT m.*, 
               row_to_json(ht.*) as homeTeam, 
               row_to_json(at.*) as awayTeam 
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        WHERE m.home_team_id = $1 OR m.away_team_id = $1
        ORDER BY m.match_date DESC
        LIMIT $2 OFFSET $3
      `;
      const result = await db.query(query, [id, parseInt(limit, 10), parseInt(offset, 10)]);
      
      const formatted = result.rows.map(row => withAnalysisConfig(mapDbRowToMatch(row), 'server-db', req));
      
      return res.json({ data: formatted, pagination: { limit: parseInt(limit, 10), offset: parseInt(offset, 10), count: formatted.length } });
    } catch (err) {
      console.error('DB Error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  }

  // Fallback to Mock Data
  const teamMatches = MOCK_MATCHES.filter(m => m.homeTeam.id === id || m.awayTeam.id === id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const paginated = teamMatches
    .slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10))
    .map(match => withAnalysisConfig(match, 'server-mock', req));
  res.json({ data: paginated, pagination: { limit: parseInt(limit, 10), offset: parseInt(offset, 10), count: paginated.length, total: teamMatches.length } });
});

// 2. Get Match Detail
app.get('/matches/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (db.isConnected()) {
    try {
      const query = `
        SELECT m.*, 
               row_to_json(ht.*) as homeTeam, 
               row_to_json(at.*) as awayTeam 
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        WHERE m.id = $1
      `;
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Match not found' } });
      }

      const row = result.rows[0];
      const formatted = withAnalysisConfig(mapDbRowToMatch(row), 'server-db', req);
      
      return res.json({ data: formatted });
    } catch (err) {
      console.error('DB Error:', err);
      return res.status(500).json({ error: { message: 'Database query failed' } });
    }
  }

  const match = MOCK_MATCHES.find(m => m.id === id);
  if (!match) {
    return res.status(404).json({ error: { message: 'Match not found' } });
  }

  res.json({ data: withAnalysisConfig(match, 'server-mock', req) });
});

// 2.5 Resolve Analysis Config by Match ID
app.get('/analysis/config/match/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const snapshot = await getMatchSnapshotById(id);
    if (!snapshot) {
      return res.status(404).json({ error: { message: 'Match not found' } });
    }

    const enriched = withSourceMeta(snapshot.match, snapshot.source);
    const config = buildAnalysisConfigPayload(enriched, req);
    return res.json({
      data: {
        matchId: id,
        ...config
      }
    });
  } catch (err) {
    console.error('Analysis config error:', err);
    return res.status(500).json({ error: { message: 'Failed to resolve analysis config' } });
  }
});

// 2.6 Resolve Analysis Config from Input Snapshot
app.post('/analysis/config/resolve', authenticate, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: { message: 'Request body must be an object' } });
  }

  const rawMatch = body.match || body.matchData || body.data || body;
  if (!rawMatch || typeof rawMatch !== 'object') {
    return res.status(400).json({ error: { message: 'Missing match snapshot in request body' } });
  }

  const mergedMatch = { ...rawMatch };
  const mergedSourceContext = {
    ...(rawMatch.sourceContext && typeof rawMatch.sourceContext === 'object' ? rawMatch.sourceContext : {}),
    ...(body.sourceContext && typeof body.sourceContext === 'object' ? body.sourceContext : {})
  };

  if (body.selectedSources && typeof body.selectedSources === 'object') {
    mergedSourceContext.selectedSources = {
      ...(mergedSourceContext.selectedSources && typeof mergedSourceContext.selectedSources === 'object'
        ? mergedSourceContext.selectedSources
        : {}),
      ...body.selectedSources
    };
  }

  if (Array.isArray(body.selectedSourceIds)) {
    mergedSourceContext.selectedSourceIds = body.selectedSourceIds;
  }

  if (body.capabilities && typeof body.capabilities === 'object') {
    mergedSourceContext.capabilities = {
      ...(mergedSourceContext.capabilities && typeof mergedSourceContext.capabilities === 'object'
        ? mergedSourceContext.capabilities
        : {}),
      ...body.capabilities
    };
  }

  if (Object.keys(mergedSourceContext).length > 0) {
    mergedMatch.sourceContext = mergedSourceContext;
  }

  const config = buildAnalysisConfigPayload(mergedMatch, req);
  const data = {
    ...config
  };
  if (typeof mergedMatch.id === 'string' && mergedMatch.id.trim().length > 0) {
    data.matchId = mergedMatch.id.trim();
  }

  return res.json({ data });
});

function sendHubManifest(kind, req, res) {
  const version = Array.isArray(req.query.version)
    ? req.query.version[0]
    : req.query.version;
  const manifest = getHubManifest(kind, req.params.id, version);
  if (!manifest) {
    return res.status(404).json({ error: { message: `${kind} manifest not found` } });
  }
  return res.json({ data: manifest });
}

['agent', 'skill', 'template'].forEach((kind) => {
  const plural = `${kind}s`;
  const paths = [
    `/hub/${plural}/:id`,
    `/hub/${kind}/:id`,
    `/extensions/${plural}/:id`,
    `/extensions/${kind}/:id`
  ];

  paths.forEach((routePath) => {
    app.get(routePath, authenticate, (req, res) => sendHubManifest(kind, req, res));
  });
});

// --- Admin Routes (For Data Injection) ---

// 3. Initialize DB (Create Tables)
app.post('/admin/init', authenticate, async (req, res) => {
  if (!db.isConnected()) {
    return res.status(500).json({ error: { message: 'Database not connected' } });
  }

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schemaSql);
    res.json({ message: 'Database initialized successfully' });
  } catch (err) {
    console.error('Init Error:', err);
    res.status(500).json({ error: { message: 'Failed to initialize database', details: err.message } });
  }
});

// 4. Upsert Team
app.post('/admin/teams', authenticate, async (req, res) => {
  if (!db.isConnected()) {
    return res.status(500).json({ error: { message: 'Database not connected' } });
  }

  const { id, name, logo_url, recent_form } = req.body;

  if (!name) {
    return res.status(400).json({ error: { message: 'Team name is required' } });
  }

  try {
    // If ID is provided, try to update or insert with that ID. 
    // If not, let DB generate UUID (but we need to return it).
    // Here we assume the client might provide an external ID (e.g. from API-Football) mapped to UUID or just use UUID.
    // For simplicity, let's use ON CONFLICT if ID is provided.
    
    let query, params;
    
    if (id) {
      query = `
        INSERT INTO teams (id, name, logo_url, recent_form)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          logo_url = EXCLUDED.logo_url,
          recent_form = EXCLUDED.recent_form
        RETURNING *
      `;
      params = [id, name, logo_url, JSON.stringify(recent_form || [])];
    } else {
      query = `
        INSERT INTO teams (name, logo_url, recent_form)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      params = [name, logo_url, JSON.stringify(recent_form || [])];
    }

    const result = await db.query(query, params);
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Team Upsert Error:', err);
    res.status(500).json({ error: { message: 'Failed to upsert team' } });
  }
});

// 5. Upsert Match
app.post('/admin/matches', authenticate, async (req, res) => {
  if (!db.isConnected()) {
    return res.status(500).json({ error: { message: 'Database not connected' } });
  }

  const { 
    id, league_name, match_date, status, 
    home_team_id, away_team_id, 
    home_score, away_score, match_stats, odds
  } = req.body;

  if (!league_name || !match_date || !home_team_id || !away_team_id) {
    return res.status(400).json({ error: { message: 'Missing required match fields' } });
  }

  try {
    let query, params;

    if (id) {
      query = `
        INSERT INTO matches (
          id, league_name, match_date, status, 
          home_team_id, away_team_id, 
          home_score, away_score, match_stats, odds
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          league_name = EXCLUDED.league_name,
          match_date = EXCLUDED.match_date,
          status = EXCLUDED.status,
          home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          match_stats = EXCLUDED.match_stats,
          odds = EXCLUDED.odds
        RETURNING *
      `;
      params = [
        id, league_name, match_date, status || 'upcoming',
        home_team_id, away_team_id,
        home_score || 0, away_score || 0,
        JSON.stringify(match_stats || {}),
        JSON.stringify(odds || {})
      ];
    } else {
      query = `
        INSERT INTO matches (
          league_name, match_date, status, 
          home_team_id, away_team_id, 
          home_score, away_score, match_stats, odds
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      params = [
        league_name, match_date, status || 'upcoming',
        home_team_id, away_team_id,
        home_score || 0, away_score || 0,
        JSON.stringify(match_stats || {}),
        JSON.stringify(odds || {})
      ];
    }

    const result = await db.query(query, params);
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Match Upsert Error:', err);
    res.status(500).json({ error: { message: 'Failed to upsert match', details: err.message } });
  }
});

// 6. Update Match Score/Status
app.put('/admin/matches/:id/score', authenticate, async (req, res) => {
  const { id } = req.params;
  const { status, home_score, away_score, match_stats, odds } = req.body;

  if (db.isConnected()) {
    try {
      const query = `
        UPDATE matches SET
          status = COALESCE($1, status),
          home_score = COALESCE($2, home_score),
          away_score = COALESCE($3, away_score),
          match_stats = COALESCE($4, match_stats),
          odds = COALESCE($5, odds)
        WHERE id = $6
        RETURNING *
      `;
      const params = [
        status, 
        home_score, 
        away_score, 
        match_stats ? JSON.stringify(match_stats) : null, 
        odds ? JSON.stringify(odds) : null,
        id
      ];
      
      const result = await db.query(query, params);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Match not found' } });
      }
      return res.json({ data: result.rows[0] });
    } catch (err) {
      console.error('Match Update Error:', err);
      return res.status(500).json({ error: { message: 'Failed to update match' } });
    }
  }

  // Fallback to Mock Data
  const index = MOCK_MATCHES.findIndex(m => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: { message: 'Match not found' } });
  }

  if (status) MOCK_MATCHES[index].status = status;
  if (home_score !== undefined || away_score !== undefined) {
    MOCK_MATCHES[index].score = {
      home: home_score !== undefined ? home_score : MOCK_MATCHES[index].score?.home || 0,
      away: away_score !== undefined ? away_score : MOCK_MATCHES[index].score?.away || 0
    };
  }
  if (match_stats) MOCK_MATCHES[index].stats = match_stats;
  if (odds) MOCK_MATCHES[index].odds = odds;

  res.json({ data: MOCK_MATCHES[index] });
});

// 7. Delete Match
app.delete('/admin/matches/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (db.isConnected()) {
    try {
      const result = await db.query('DELETE FROM matches WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Match not found' } });
      }
      return res.json({ message: 'Match deleted successfully' });
    } catch (err) {
      console.error('Match Delete Error:', err);
      return res.status(500).json({ error: { message: 'Failed to delete match' } });
    }
  }

  const index = MOCK_MATCHES.findIndex(m => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: { message: 'Match not found' } });
  }

  MOCK_MATCHES.splice(index, 1);
  res.json({ message: 'Match deleted successfully' });
});

// 8. Delete Team
app.delete('/admin/teams/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (db.isConnected()) {
    try {
      const result = await db.query('DELETE FROM teams WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Team not found' } });
      }
      return res.json({ message: 'Team deleted successfully' });
    } catch (err) {
      console.error('Team Delete Error:', err);
      return res.status(500).json({ error: { message: 'Failed to delete team. It might be referenced by existing matches.' } });
    }
  }

  return res.status(400).json({ error: { message: 'Cannot delete teams in mock mode' } });
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    db_connected: db.isConnected() 
  });
});

app.listen(PORT, () => {
  console.log(`Match Data Server running on port ${PORT}`);
  console.log(`API Key configured: ${API_KEY.substring(0, 4)}...`);
  console.log(`Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Not Configured (Using Mock Data)'}`);
});
