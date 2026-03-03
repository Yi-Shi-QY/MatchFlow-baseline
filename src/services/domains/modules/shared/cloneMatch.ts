import type { Match } from "@/src/data/matches";

export function cloneMatch(match: Match): Match {
  return {
    ...match,
    capabilities: match.capabilities ? { ...match.capabilities } : undefined,
    homeTeam: {
      ...match.homeTeam,
      form: Array.isArray(match.homeTeam?.form) ? [...match.homeTeam.form] : [],
    },
    awayTeam: {
      ...match.awayTeam,
      form: Array.isArray(match.awayTeam?.form) ? [...match.awayTeam.form] : [],
    },
    score: match.score ? { ...match.score } : undefined,
    stats: match.stats
      ? {
          possession: { ...match.stats.possession },
          shots: { ...match.stats.shots },
          shotsOnTarget: { ...match.stats.shotsOnTarget },
        }
      : undefined,
    odds: match.odds
      ? {
          had: match.odds.had ? { ...match.odds.had } : undefined,
          hhad: match.odds.hhad ? { ...match.odds.hhad } : undefined,
        }
      : undefined,
  };
}

