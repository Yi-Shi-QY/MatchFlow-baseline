require('dotenv').config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5432/matchflow';
}
if (!process.env.DB_SSL_MODE) {
  process.env.DB_SSL_MODE = 'disable';
}

const db = require('../db');
const matchRepository = require('../src/repositories/matchRepository');

const TEAM_IDS = {
  arsenal: '11000000-0000-0000-0000-000000000001',
  chelsea: '11000000-0000-0000-0000-000000000002',
  realMadrid: '11000000-0000-0000-0000-000000000003',
  barcelona: '11000000-0000-0000-0000-000000000004',
  juventus: '11000000-0000-0000-0000-000000000005',
  interMilan: '11000000-0000-0000-0000-000000000006',
  bayern: '11000000-0000-0000-0000-000000000007',
  dortmund: '11000000-0000-0000-0000-000000000008',
};

const MATCH_IDS = {
  premierUpcoming: '22000000-0000-0000-0000-000000000001',
  laLigaLive: '22000000-0000-0000-0000-000000000002',
  serieAFinished: '22000000-0000-0000-0000-000000000003',
  bundesligaUpcoming: '22000000-0000-0000-0000-000000000004',
};

function atOffsetHours(offsetHours) {
  return new Date(Date.now() + offsetHours * 60 * 60 * 1000).toISOString();
}

const TEAMS = [
  {
    id: TEAM_IDS.arsenal,
    name: 'Arsenal',
    logo_url: 'https://media.api-sports.io/football/teams/42.png',
    recent_form: ['W', 'W', 'D', 'W', 'W'],
  },
  {
    id: TEAM_IDS.chelsea,
    name: 'Chelsea',
    logo_url: 'https://media.api-sports.io/football/teams/49.png',
    recent_form: ['L', 'D', 'W', 'L', 'D'],
  },
  {
    id: TEAM_IDS.realMadrid,
    name: 'Real Madrid',
    logo_url: 'https://media.api-sports.io/football/teams/541.png',
    recent_form: ['W', 'W', 'D', 'W', 'L'],
  },
  {
    id: TEAM_IDS.barcelona,
    name: 'Barcelona',
    logo_url: 'https://media.api-sports.io/football/teams/529.png',
    recent_form: ['W', 'W', 'W', 'W', 'D'],
  },
  {
    id: TEAM_IDS.juventus,
    name: 'Juventus',
    logo_url: 'https://media.api-sports.io/football/teams/496.png',
    recent_form: ['W', 'D', 'W', 'L', 'W'],
  },
  {
    id: TEAM_IDS.interMilan,
    name: 'Inter Milan',
    logo_url: 'https://media.api-sports.io/football/teams/505.png',
    recent_form: ['W', 'W', 'W', 'D', 'W'],
  },
  {
    id: TEAM_IDS.bayern,
    name: 'Bayern Munich',
    logo_url: 'https://media.api-sports.io/football/teams/157.png',
    recent_form: ['W', 'W', 'L', 'W', 'D'],
  },
  {
    id: TEAM_IDS.dortmund,
    name: 'Borussia Dortmund',
    logo_url: 'https://media.api-sports.io/football/teams/165.png',
    recent_form: ['D', 'W', 'W', 'L', 'W'],
  },
];

const MATCHES = [
  {
    id: MATCH_IDS.premierUpcoming,
    league_name: 'Premier League',
    match_date: atOffsetHours(8),
    status: 'upcoming',
    home_team_id: TEAM_IDS.arsenal,
    away_team_id: TEAM_IDS.chelsea,
    home_score: 0,
    away_score: 0,
    match_stats: {
      possession: { home: 57, away: 43 },
      shots: { home: 15, away: 9 },
      shotsOnTarget: { home: 6, away: 3 },
      corners: { home: 7, away: 4 },
    },
    odds: {
      had: { h: 1.74, d: 3.85, a: 4.85 },
      hhad: { h: 2.18, d: 3.45, a: 2.98, goalline: -1 },
    },
    source_context: {
      domainId: 'football',
      selectedSources: {
        fundamental: true,
        market: true,
        custom: false,
      },
      selectedSourceIds: ['fundamental', 'market'],
      capabilities: {
        hasFundamental: true,
        hasStats: true,
        hasOdds: true,
        hasCustom: false,
      },
      planning: {
        mode: 'template',
        templateId: 'comprehensive',
        sequencePreference: ['fundamental', 'market', 'prediction'],
        seedProfile: 'local_football_test',
      },
    },
  },
  {
    id: MATCH_IDS.laLigaLive,
    league_name: 'La Liga',
    match_date: atOffsetHours(0),
    status: 'live',
    home_team_id: TEAM_IDS.realMadrid,
    away_team_id: TEAM_IDS.barcelona,
    home_score: 1,
    away_score: 1,
    match_stats: {
      possession: { home: 49, away: 51 },
      shots: { home: 13, away: 14 },
      shotsOnTarget: { home: 5, away: 6 },
      dangerousAttacks: { home: 39, away: 42 },
    },
    odds: {
      had: { h: 2.28, d: 2.95, a: 3.15 },
      hhad: { h: 4.2, d: 3.6, a: 1.82, goalline: -1 },
    },
    source_context: {
      domainId: 'football',
      selectedSources: {
        fundamental: true,
        market: true,
        custom: false,
      },
      selectedSourceIds: ['fundamental', 'market'],
      capabilities: {
        hasFundamental: true,
        hasStats: true,
        hasOdds: true,
        hasCustom: false,
      },
      planning: {
        mode: 'template',
        templateId: 'live_market_pro',
        sequencePreference: ['overview', 'momentum', 'odds', 'prediction'],
        seedProfile: 'local_football_test',
      },
    },
  },
  {
    id: MATCH_IDS.serieAFinished,
    league_name: 'Serie A',
    match_date: atOffsetHours(-20),
    status: 'finished',
    home_team_id: TEAM_IDS.juventus,
    away_team_id: TEAM_IDS.interMilan,
    home_score: 1,
    away_score: 2,
    match_stats: {
      possession: { home: 44, away: 56 },
      shots: { home: 10, away: 17 },
      shotsOnTarget: { home: 4, away: 8 },
      xg: { home: 1.08, away: 1.94 },
    },
    odds: {
      had: { h: 2.62, d: 3.12, a: 2.63 },
      hhad: { h: 5.1, d: 3.75, a: 1.66, goalline: 0 },
    },
    source_context: {
      domainId: 'football',
      selectedSources: {
        fundamental: true,
        market: true,
        custom: false,
      },
      selectedSourceIds: ['fundamental', 'market'],
      capabilities: {
        hasFundamental: true,
        hasStats: true,
        hasOdds: true,
        hasCustom: false,
      },
      planning: {
        mode: 'template',
        templateId: 'standard',
        sequencePreference: ['fundamental', 'review', 'prediction'],
        seedProfile: 'local_football_test',
      },
    },
  },
  {
    id: MATCH_IDS.bundesligaUpcoming,
    league_name: 'Bundesliga',
    match_date: atOffsetHours(28),
    status: 'upcoming',
    home_team_id: TEAM_IDS.bayern,
    away_team_id: TEAM_IDS.dortmund,
    home_score: 0,
    away_score: 0,
    match_stats: {
      possession: { home: 61, away: 39 },
      shots: { home: 18, away: 10 },
      shotsOnTarget: { home: 8, away: 4 },
      corners: { home: 9, away: 3 },
    },
    odds: {
      had: { h: 1.68, d: 4.15, a: 4.55 },
      hhad: { h: 2.04, d: 3.7, a: 3.1, goalline: -1.25 },
    },
    source_context: {
      domainId: 'football',
      selectedSources: {
        fundamental: true,
        market: true,
        custom: false,
      },
      selectedSourceIds: ['fundamental', 'market'],
      capabilities: {
        hasFundamental: true,
        hasStats: true,
        hasOdds: true,
        hasCustom: false,
      },
      planning: {
        mode: 'template',
        templateId: 'odds_focused',
        sequencePreference: ['market', 'fundamental', 'prediction'],
        seedProfile: 'local_football_test',
      },
    },
  },
];

async function ensureTestSchema() {
  if (!db.isConnected()) {
    throw new Error(
      'Database is not connected. Start Postgres first and set DATABASE_URL if you are not using the default local instance.',
    );
  }

  await db.query(`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS source_context JSONB DEFAULT '{}'::jsonb
  `);

  await db.query(`
    UPDATE matches
    SET source_context = jsonb_set(
      COALESCE(source_context, '{}'::jsonb),
      '{domainId}',
      '"football"'::jsonb,
      true
    )
    WHERE COALESCE(source_context->>'domainId', '') = ''
  `);
}

async function main() {
  try {
    await ensureTestSchema();

    for (const team of TEAMS) {
      await matchRepository.upsertTeam(team);
    }

    for (const match of MATCHES) {
      await matchRepository.upsertMatch(match);
    }

    const seeded = await matchRepository.listMatches({
      domainId: 'football',
      limit: 20,
      offset: 0,
    });

    console.log(`[seed-football] teams upserted: ${TEAMS.length}`);
    console.log(`[seed-football] matches upserted: ${MATCHES.length}`);
    console.log(`[seed-football] football matches now available: ${seeded.data.length}`);
    seeded.data.forEach((match) => {
      console.log(
        `[seed-football] ${match.id} | ${match.league} | ${match.homeTeam.name} vs ${match.awayTeam.name} | ${match.status}`,
      );
    });
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error('[seed-football] failed');
  console.error(error);
  process.exit(1);
});
