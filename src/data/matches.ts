export interface Match {
  id: string;
  league: string;
  source?: string;
  capabilities?: {
    hasStats: boolean;
    hasOdds: boolean;
    hasCustom: boolean;
  };
  homeTeam: {
    id: string;
    name: string;
    logo: string;
    form: string[];
  };
  awayTeam: {
    id: string;
    name: string;
    logo: string;
    form: string[];
  };
  date: string;
  status: 'upcoming' | 'live' | 'finished';
  score?: {
    home: number;
    away: number;
  };
  stats?: {
    possession: { home: number; away: number };
    shots: { home: number; away: number };
    shotsOnTarget: { home: number; away: number };
  };
  odds?: {
    had?: { h: number; d: number; a: number }; // Win/Draw/Loss odds
    hhad?: { h: number; d: number; a: number; goalline: number }; // Handicap Win/Draw/Loss odds
  };
}

export const MOCK_MATCHES: Match[] = [
  {
    id: 'm1',
    league: 'Premier League',
    homeTeam: {
      id: 't1',
      name: 'Arsenal',
      logo: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
      form: ['W', 'W', 'D', 'W', 'L'],
    },
    awayTeam: {
      id: 't2',
      name: 'Manchester City',
      logo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
      form: ['W', 'W', 'W', 'D', 'W'],
    },
    date: new Date(Date.now() + 86400000).toISOString(),
    status: 'upcoming',
    odds: {
      had: { h: 2.45, d: 3.20, a: 2.45 },
      hhad: { h: 1.42, d: 4.20, a: 5.30, goalline: 1 }
    }
  },
  {
    id: 'm2',
    league: 'La Liga',
    homeTeam: {
      id: 't3',
      name: 'Real Madrid',
      logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
      form: ['W', 'D', 'W', 'W', 'W'],
    },
    awayTeam: {
      id: 't4',
      name: 'Barcelona',
      logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
      form: ['W', 'W', 'L', 'W', 'W'],
    },
    date: new Date(Date.now() - 3600000).toISOString(),
    status: 'live',
    score: { home: 1, away: 1 },
    stats: {
      possession: { home: 45, away: 55 },
      shots: { home: 8, away: 12 },
      shotsOnTarget: { home: 3, away: 5 },
    },
    odds: {
      had: { h: 2.10, d: 3.40, a: 2.80 },
      hhad: { h: 4.10, d: 3.90, a: 1.58, goalline: -1 }
    }
  },
  {
    id: 'm3',
    league: 'Serie A',
    homeTeam: {
      id: 't5',
      name: 'Juventus',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Juventus_FC_2017_icon_%28black%29.svg',
      form: ['D', 'W', 'W', 'D', 'W'],
    },
    awayTeam: {
      id: 't6',
      name: 'AC Milan',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg',
      form: ['W', 'L', 'W', 'W', 'D'],
    },
    date: new Date(Date.now() + 172800000).toISOString(),
    status: 'upcoming',
    odds: {
      had: { h: 1.85, d: 3.10, a: 3.80 },
      hhad: { h: 3.75, d: 3.40, a: 1.75, goalline: -1 }
    }
  }
];
