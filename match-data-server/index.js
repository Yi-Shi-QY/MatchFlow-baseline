require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'your-secret-key';

app.use(cors());
app.use(express.json());

// Mock Data
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

// Routes
app.get('/matches', authenticate, (req, res) => {
  const { date, status } = req.query;
  
  let filtered = [...MOCK_MATCHES];

  if (status) {
    filtered = filtered.filter(m => m.status === status);
  }

  // Simple date filtering (exact match on YYYY-MM-DD)
  if (date) {
    filtered = filtered.filter(m => m.date.startsWith(date));
  }

  res.json({ data: filtered });
});

app.get('/matches/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const match = MOCK_MATCHES.find(m => m.id === id);

  if (!match) {
    return res.status(404).json({ error: { message: 'Match not found' } });
  }

  res.json({ data: match });
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Match Data Server running on port ${PORT}`);
  console.log(`API Key configured: ${API_KEY.substring(0, 4)}...`);
});
