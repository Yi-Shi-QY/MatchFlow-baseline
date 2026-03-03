import type { Match } from "@/src/data/matches";

export function buildBasketballLocalCases(): Match[] {
  const now = Date.now();

  return [
    {
      id: "b1",
      source: "local-builtin",
      league: "NBA Regular Season",
      homeTeam: {
        id: "nba_lal",
        name: "Los Angeles Lakers",
        logo: "https://upload.wikimedia.org/wikipedia/commons/3/3c/Los_Angeles_Lakers_logo.svg",
        form: ["W", "L", "W", "W", "L"],
      },
      awayTeam: {
        id: "nba_bos",
        name: "Boston Celtics",
        logo: "https://upload.wikimedia.org/wikipedia/en/8/8f/Boston_Celtics.svg",
        form: ["W", "W", "W", "L", "W"],
      },
      date: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
      status: "upcoming",
      odds: {
        had: { h: 1.9, d: 0, a: 1.96 },
        hhad: { h: 1.87, d: 0, a: 1.93, goalline: -1.5 },
      },
      capabilities: {
        hasStats: false,
        hasOdds: true,
        hasCustom: false,
      },
    },
    {
      id: "b2",
      source: "local-builtin",
      league: "NBA Regular Season",
      homeTeam: {
        id: "nba_gsw",
        name: "Golden State Warriors",
        logo: "https://upload.wikimedia.org/wikipedia/en/0/01/Golden_State_Warriors_logo.svg",
        form: ["L", "W", "W", "L", "W"],
      },
      awayTeam: {
        id: "nba_den",
        name: "Denver Nuggets",
        logo: "https://upload.wikimedia.org/wikipedia/en/7/76/Denver_Nuggets.svg",
        form: ["W", "W", "L", "W", "W"],
      },
      date: new Date(now - 25 * 60 * 1000).toISOString(),
      status: "live",
      score: { home: 94, away: 97 },
      stats: {
        possession: { home: 48, away: 52 },
        shots: { home: 79, away: 82 },
        shotsOnTarget: { home: 36, away: 38 },
      },
      odds: {
        had: { h: 2.08, d: 0, a: 1.78 },
        hhad: { h: 1.95, d: 0, a: 1.92, goalline: 2.5 },
      },
      capabilities: {
        hasStats: true,
        hasOdds: true,
        hasCustom: false,
      },
    },
    {
      id: "b3",
      source: "local-builtin",
      league: "NBA Regular Season",
      homeTeam: {
        id: "nba_mia",
        name: "Miami Heat",
        logo: "https://upload.wikimedia.org/wikipedia/en/f/fb/Miami_Heat_logo.svg",
        form: ["W", "W", "L", "L", "W"],
      },
      awayTeam: {
        id: "nba_nyk",
        name: "New York Knicks",
        logo: "https://upload.wikimedia.org/wikipedia/en/2/25/New_York_Knicks_logo.svg",
        form: ["L", "W", "W", "W", "L"],
      },
      date: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      status: "finished",
      score: { home: 112, away: 108 },
      stats: {
        possession: { home: 52, away: 48 },
        shots: { home: 88, away: 84 },
        shotsOnTarget: { home: 43, away: 40 },
      },
      capabilities: {
        hasStats: true,
        hasOdds: false,
        hasCustom: false,
      },
    },
  ];
}

