const SERVER_URL = 'http://localhost:3001';
const API_KEY = 'your-secret-key';

// Sample Data
const TEAMS = [
  {
    name: 'Manchester City',
    logo_url: 'https://media.api-sports.io/football/teams/50.png',
    recent_form: ['W', 'W', 'W', 'D', 'W']
  },
  {
    name: 'Liverpool',
    logo_url: 'https://media.api-sports.io/football/teams/40.png',
    recent_form: ['W', 'L', 'W', 'W', 'D']
  }
];

const MATCH = {
  league_name: 'Premier League',
  match_date: new Date(Date.now() + 3600000 * 24).toISOString(), // Tomorrow
  status: 'upcoming',
  // We will fill these IDs after creating teams
  home_team_id: null,
  away_team_id: null,
  home_score: 0,
  away_score: 0,
  match_stats: {
    possession: { home: 50, away: 50 }
  }
};

async function post(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed: ${response.status} ${errorText}`);
  }
  
  return response.json();
}

async function main() {
  try {
    // 1. Initialize Database (Create Tables if not exist)
    console.log('Initializing database...');
    // Note: This endpoint is idempotent (safe to call multiple times)
    await post(`${SERVER_URL}/admin/init`, {});
    console.log('Database initialized.');

    // 2. Create Teams
    console.log('Creating teams...');
    const teamIds = {};
    
    for (const team of TEAMS) {
      const res = await post(`${SERVER_URL}/admin/teams`, team);
      // The API returns { data: { ... } }
      const teamData = res.data;
      teamIds[team.name] = teamData.id;
      console.log(`Created team: ${team.name} (ID: ${teamData.id})`);
    }

    // 3. Create Match
    console.log('Creating match...');
    MATCH.home_team_id = teamIds['Manchester City'];
    MATCH.away_team_id = teamIds['Liverpool'];

    const matchRes = await post(`${SERVER_URL}/admin/matches`, MATCH);
    console.log(`Created match: ${MATCH.league_name} (ID: ${matchRes.data.id})`);

    console.log('Done! Check http://localhost:3001/matches to see the data.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
