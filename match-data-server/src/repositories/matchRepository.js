const db = require('../../db');
const { MOCK_MATCHES } = require('../mock/matches');

const SOURCE_DB = 'server-db';
const SOURCE_MOCK = 'server-mock';
const DEFAULT_DOMAIN_ID = 'football';

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDomainId(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : '';
}

function withDefaultDomainContext(match, fallbackDomainId = DEFAULT_DOMAIN_ID) {
  if (!isPlainObject(match)) return match;
  const sourceContext = isPlainObject(match.sourceContext) ? { ...match.sourceContext } : {};
  const domainId = normalizeDomainId(sourceContext.domainId) || fallbackDomainId;
  sourceContext.domainId = domainId;

  return {
    ...match,
    sourceContext,
  };
}

function matchesDomain(match, domainId) {
  if (!domainId) return true;
  const resolvedDomainId = normalizeDomainId(match?.sourceContext?.domainId) || DEFAULT_DOMAIN_ID;
  return resolvedDomainId === domainId;
}

function mapDbRowToMatch(row) {
  const homeTeam = row?.homeTeam || row?.hometeam || {};
  const awayTeam = row?.awayTeam || row?.awayteam || {};
  const sourceContextRaw = row?.sourceContext || row?.source_context;

  return withDefaultDomainContext({
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
      form: homeTeam.recent_form,
    },
    awayTeam: {
      id: awayTeam.id,
      name: awayTeam.name,
      logo: awayTeam.logo_url,
      form: awayTeam.recent_form,
    },
    sourceContext: isPlainObject(sourceContextRaw) ? sourceContextRaw : undefined,
  });
}

async function listMatches(params = {}) {
  const date = params.date;
  const status = params.status;
  const search = params.search;
  const domainId = normalizeDomainId(params.domainId);
  const limit = toInt(params.limit, 50);
  const offset = toInt(params.offset, 0);

  if (db.isConnected()) {
    let query = `
      SELECT m.*, 
             row_to_json(ht.*) as homeTeam, 
             row_to_json(at.*) as awayTeam 
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE 1=1
    `;
    const sqlParams = [];

    if (status) {
      sqlParams.push(status);
      query += ` AND m.status = $${sqlParams.length}`;
    }

    if (date) {
      sqlParams.push(date);
      query += ` AND DATE(m.match_date) = $${sqlParams.length}`;
    }

    if (search) {
      sqlParams.push(`%${search}%`);
      query += ` AND (ht.name ILIKE $${sqlParams.length} OR at.name ILIKE $${sqlParams.length} OR m.league_name ILIKE $${sqlParams.length})`;
    }

    query += ' ORDER BY m.match_date ASC';

    sqlParams.push(limit);
    query += ` LIMIT $${sqlParams.length}`;

    sqlParams.push(offset);
    query += ` OFFSET $${sqlParams.length}`;

    const result = await db.query(query, sqlParams);
    const data = result.rows
      .map(mapDbRowToMatch)
      .filter((item) => matchesDomain(item, domainId));
    return {
      data,
      source: SOURCE_DB,
      pagination: { limit, offset, count: data.length },
    };
  }

  let filtered = [...MOCK_MATCHES].map((item) => withDefaultDomainContext(item));

  if (status) {
    filtered = filtered.filter((item) => item.status === status);
  }

  if (date) {
    filtered = filtered.filter((item) => String(item.date).startsWith(String(date)));
  }

  if (search) {
    const normalizedSearch = String(search).toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.homeTeam.name.toLowerCase().includes(normalizedSearch) ||
        item.awayTeam.name.toLowerCase().includes(normalizedSearch) ||
        item.league.toLowerCase().includes(normalizedSearch),
    );
  }

  if (domainId) {
    filtered = filtered.filter((item) => matchesDomain(item, domainId));
  }

  const data = filtered.slice(offset, offset + limit);
  return {
    data,
    source: SOURCE_MOCK,
    pagination: { limit, offset, count: data.length, total: filtered.length },
  };
}

async function listLiveMatches() {
  if (db.isConnected()) {
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
    const data = result.rows.map(mapDbRowToMatch);
    return {
      data,
      source: SOURCE_DB,
      count: data.length,
    };
  }

  const data = MOCK_MATCHES
    .filter((item) => item.status === 'live')
    .map((item) => withDefaultDomainContext(item));
  return {
    data,
    source: SOURCE_MOCK,
    count: data.length,
  };
}

async function listTeams(params = {}) {
  const search = params.search;
  const limit = toInt(params.limit, 50);
  const offset = toInt(params.offset, 0);

  if (db.isConnected()) {
    let query = 'SELECT * FROM teams WHERE 1=1';
    const sqlParams = [];

    if (search) {
      sqlParams.push(`%${search}%`);
      query += ` AND name ILIKE $${sqlParams.length}`;
    }

    query += ' ORDER BY name ASC';

    sqlParams.push(limit);
    query += ` LIMIT $${sqlParams.length}`;

    sqlParams.push(offset);
    query += ` OFFSET $${sqlParams.length}`;

    const result = await db.query(query, sqlParams);
    return {
      data: result.rows,
      pagination: { limit, offset, count: result.rows.length },
    };
  }

  const teamMap = new Map();
  MOCK_MATCHES.forEach((item) => {
    if (!teamMap.has(item.homeTeam.id)) teamMap.set(item.homeTeam.id, item.homeTeam);
    if (!teamMap.has(item.awayTeam.id)) teamMap.set(item.awayTeam.id, item.awayTeam);
  });

  let teams = Array.from(teamMap.values());
  if (search) {
    const normalizedSearch = String(search).toLowerCase();
    teams = teams.filter((team) => team.name.toLowerCase().includes(normalizedSearch));
  }

  const data = teams.slice(offset, offset + limit);
  return {
    data,
    pagination: { limit, offset, count: data.length, total: teams.length },
  };
}

async function listLeagues() {
  if (db.isConnected()) {
    const query = 'SELECT DISTINCT league_name FROM matches ORDER BY league_name ASC';
    const result = await db.query(query);
    return result.rows.map((row) => row.league_name);
  }

  return [...new Set(MOCK_MATCHES.map((item) => item.league))].sort();
}

async function listTeamMatches(teamId, params = {}) {
  const limit = toInt(params.limit, 10);
  const offset = toInt(params.offset, 0);

  if (db.isConnected()) {
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
    const result = await db.query(query, [teamId, limit, offset]);
    const data = result.rows.map(mapDbRowToMatch);
    return {
      data,
      source: SOURCE_DB,
      pagination: { limit, offset, count: data.length },
    };
  }

  const teamMatches = MOCK_MATCHES.filter(
    (item) => item.homeTeam.id === teamId || item.awayTeam.id === teamId,
  )
    .map((item) => withDefaultDomainContext(item))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const data = teamMatches.slice(offset, offset + limit);
  return {
    data,
    source: SOURCE_MOCK,
    pagination: { limit, offset, count: data.length, total: teamMatches.length },
  };
}

async function getMatchById(matchId) {
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
    const result = await db.query(query, [matchId]);
    if (result.rows.length === 0) return null;
    return {
      match: mapDbRowToMatch(result.rows[0]),
      source: SOURCE_DB,
    };
  }

  const match = MOCK_MATCHES.find((item) => item.id === matchId);
  if (!match) return null;
  return { match: withDefaultDomainContext(match), source: SOURCE_MOCK };
}

async function upsertTeam(payload) {
  if (!db.isConnected()) {
    throw new Error('Database not connected');
  }

  const { id, name, logo_url, recent_form } = payload;
  if (!name) {
    throw new Error('Team name is required');
  }

  let query;
  let params;

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
  return result.rows[0];
}

async function upsertMatch(payload) {
  if (!db.isConnected()) {
    throw new Error('Database not connected');
  }

  const {
    id,
    league_name,
    match_date,
    status,
    home_team_id,
    away_team_id,
    home_score,
    away_score,
    match_stats,
    odds,
  } = payload;

  if (!league_name || !match_date || !home_team_id || !away_team_id) {
    throw new Error('Missing required match fields');
  }

  let query;
  let params;

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
      id,
      league_name,
      match_date,
      status || 'upcoming',
      home_team_id,
      away_team_id,
      home_score || 0,
      away_score || 0,
      JSON.stringify(match_stats || {}),
      JSON.stringify(odds || {}),
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
      league_name,
      match_date,
      status || 'upcoming',
      home_team_id,
      away_team_id,
      home_score || 0,
      away_score || 0,
      JSON.stringify(match_stats || {}),
      JSON.stringify(odds || {}),
    ];
  }

  const result = await db.query(query, params);
  return result.rows[0];
}

async function updateMatchScore(matchId, payload) {
  const { status, home_score, away_score, match_stats, odds } = payload;

  if (db.isConnected()) {
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
      matchId,
    ];
    const result = await db.query(query, params);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  const index = MOCK_MATCHES.findIndex((item) => item.id === matchId);
  if (index === -1) return null;

  if (status) MOCK_MATCHES[index].status = status;
  if (home_score !== undefined || away_score !== undefined) {
    MOCK_MATCHES[index].score = {
      home: home_score !== undefined ? home_score : MOCK_MATCHES[index].score?.home || 0,
      away: away_score !== undefined ? away_score : MOCK_MATCHES[index].score?.away || 0,
    };
  }
  if (match_stats) MOCK_MATCHES[index].stats = match_stats;
  if (odds) MOCK_MATCHES[index].odds = odds;

  return MOCK_MATCHES[index];
}

async function deleteMatch(matchId) {
  if (db.isConnected()) {
    const result = await db.query('DELETE FROM matches WHERE id = $1 RETURNING id', [matchId]);
    return result.rows.length > 0;
  }

  const index = MOCK_MATCHES.findIndex((item) => item.id === matchId);
  if (index === -1) return false;
  MOCK_MATCHES.splice(index, 1);
  return true;
}

async function deleteTeam(teamId) {
  if (!db.isConnected()) {
    throw new Error('Cannot delete teams in mock mode');
  }
  const result = await db.query('DELETE FROM teams WHERE id = $1 RETURNING id', [teamId]);
  return result.rows.length > 0;
}

module.exports = {
  SOURCE_DB,
  SOURCE_MOCK,
  mapDbRowToMatch,
  listMatches,
  listLiveMatches,
  listTeams,
  listLeagues,
  listTeamMatches,
  getMatchById,
  upsertTeam,
  upsertMatch,
  updateMatchScore,
  deleteMatch,
  deleteTeam,
};
