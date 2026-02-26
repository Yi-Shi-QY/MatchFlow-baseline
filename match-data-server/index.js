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
    stats: { possession: { home: 55, away: 45 }, shots: { home: 12, away: 8 }, shotsOnTarget: { home: 5, away: 3 } }
  },
  {
    id: 'm2',
    league: 'La Liga',
    date: new Date().toISOString(), // Today
    status: 'live',
    homeTeam: { id: 'h2', name: 'Real Madrid', logo: 'https://media.api-sports.io/football/teams/541.png', form: ['W', 'D', 'W', 'W', 'L'] },
    awayTeam: { id: 'a2', name: 'Barcelona', logo: 'https://media.api-sports.io/football/teams/529.png', form: ['W', 'W', 'W', 'W', 'W'] },
    score: { home: 1, away: 1 },
    stats: { possession: { home: 48, away: 52 }, shots: { home: 15, away: 14 }, shotsOnTarget: { home: 6, away: 7 } }
  },
  {
    id: 'm3',
    league: 'Serie A',
    date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    status: 'finished',
    homeTeam: { id: 'h3', name: 'Juventus', logo: 'https://media.api-sports.io/football/teams/496.png', form: ['D', 'D', 'W', 'L', 'W'] },
    awayTeam: { id: 'a3', name: 'AC Milan', logo: 'https://media.api-sports.io/football/teams/489.png', form: ['W', 'L', 'W', 'W', 'D'] },
    score: { home: 2, away: 0 },
    stats: { possession: { home: 40, away: 60 }, shots: { home: 8, away: 18 }, shotsOnTarget: { home: 4, away: 5 } }
  }
];

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
  const { date, status } = req.query;

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
        // Simple date check (Postgres date_trunc or similar)
        params.push(date);
        query += ` AND DATE(m.match_date) = $${params.length}`;
      }

      query += ` ORDER BY m.match_date ASC`;

      const result = await db.query(query, params);
      
      const formatted = result.rows.map(row => ({
        id: row.id,
        league: row.league_name,
        date: row.match_date,
        status: row.status,
        score: { home: row.home_score, away: row.away_score },
        stats: row.match_stats,
        homeTeam: {
          id: row.homeTeam.id,
          name: row.homeTeam.name,
          logo: row.homeTeam.logo_url,
          form: row.homeTeam.recent_form
        },
        awayTeam: {
          id: row.awayTeam.id,
          name: row.awayTeam.name,
          logo: row.awayTeam.logo_url,
          form: row.awayTeam.recent_form
        }
      }));
      
      return res.json({ data: formatted });
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

  res.json({ data: filtered });
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
      const formatted = {
        id: row.id,
        league: row.league_name,
        date: row.match_date,
        status: row.status,
        score: { home: row.home_score, away: row.away_score },
        stats: row.match_stats,
        homeTeam: {
          id: row.homeTeam.id,
          name: row.homeTeam.name,
          logo: row.homeTeam.logo_url,
          form: row.homeTeam.recent_form
        },
        awayTeam: {
          id: row.awayTeam.id,
          name: row.awayTeam.name,
          logo: row.awayTeam.logo_url,
          form: row.awayTeam.recent_form
        }
      };
      
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

  res.json({ data: match });
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
    home_score, away_score, match_stats 
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
          home_score, away_score, match_stats
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          league_name = EXCLUDED.league_name,
          match_date = EXCLUDED.match_date,
          status = EXCLUDED.status,
          home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          match_stats = EXCLUDED.match_stats
        RETURNING *
      `;
      params = [
        id, league_name, match_date, status || 'upcoming',
        home_team_id, away_team_id,
        home_score || 0, away_score || 0,
        JSON.stringify(match_stats || {})
      ];
    } else {
      query = `
        INSERT INTO matches (
          league_name, match_date, status, 
          home_team_id, away_team_id, 
          home_score, away_score, match_stats
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      params = [
        league_name, match_date, status || 'upcoming',
        home_team_id, away_team_id,
        home_score || 0, away_score || 0,
        JSON.stringify(match_stats || {})
      ];
    }

    const result = await db.query(query, params);
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Match Upsert Error:', err);
    res.status(500).json({ error: { message: 'Failed to upsert match', details: err.message } });
  }
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
