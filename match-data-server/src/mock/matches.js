const MOCK_MATCHES = [
  {
    id: 'm1',
    league: 'Premier League',
    date: new Date(Date.now() + 86400000).toISOString(),
    status: 'upcoming',
    homeTeam: {
      id: 'h1',
      name: 'Arsenal',
      logo: 'https://media.api-sports.io/football/teams/42.png',
      form: ['W', 'W', 'W', 'W', 'W'],
    },
    awayTeam: {
      id: 'a1',
      name: 'Chelsea',
      logo: 'https://media.api-sports.io/football/teams/49.png',
      form: ['L', 'D', 'W', 'L', 'D'],
    },
    stats: {
      possession: { home: 55, away: 45 },
      shots: { home: 12, away: 8 },
      shotsOnTarget: { home: 5, away: 3 },
    },
    odds: {
      had: { h: 1.8, d: 3.5, a: 4.2 },
      hhad: { h: 3.2, d: 3.4, a: 2.1, goalline: -1 },
    },
  },
  {
    id: 'm2',
    league: 'La Liga',
    date: new Date().toISOString(),
    status: 'live',
    homeTeam: {
      id: 'h2',
      name: 'Real Madrid',
      logo: 'https://media.api-sports.io/football/teams/541.png',
      form: ['W', 'D', 'W', 'W', 'L'],
    },
    awayTeam: {
      id: 'a2',
      name: 'Barcelona',
      logo: 'https://media.api-sports.io/football/teams/529.png',
      form: ['W', 'W', 'W', 'W', 'W'],
    },
    score: { home: 1, away: 1 },
    stats: {
      possession: { home: 48, away: 52 },
      shots: { home: 15, away: 14 },
      shotsOnTarget: { home: 6, away: 7 },
    },
    odds: {
      had: { h: 2.1, d: 3.3, a: 3.1 },
      hhad: { h: 4.0, d: 3.8, a: 1.7, goalline: -1 },
    },
  },
  {
    id: 'm3',
    league: 'Serie A',
    date: new Date(Date.now() - 86400000).toISOString(),
    status: 'finished',
    homeTeam: {
      id: 'h3',
      name: 'Juventus',
      logo: 'https://media.api-sports.io/football/teams/496.png',
      form: ['D', 'D', 'W', 'L', 'W'],
    },
    awayTeam: {
      id: 'a3',
      name: 'AC Milan',
      logo: 'https://media.api-sports.io/football/teams/489.png',
      form: ['W', 'L', 'W', 'W', 'D'],
    },
    score: { home: 2, away: 0 },
    stats: {
      possession: { home: 40, away: 60 },
      shots: { home: 8, away: 18 },
      shotsOnTarget: { home: 4, away: 5 },
    },
    odds: {
      had: { h: 1.9, d: 3.2, a: 3.8 },
      hhad: { h: 3.5, d: 3.3, a: 1.9, goalline: -1 },
    },
  },
];

module.exports = {
  MOCK_MATCHES,
};

