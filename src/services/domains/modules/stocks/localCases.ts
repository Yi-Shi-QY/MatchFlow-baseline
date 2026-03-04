import { MOCK_MATCHES, type Match } from '@/src/data/matches';
import { cloneMatch } from '../shared/cloneMatch';

function buildStockCase(
  base: Match,
  config: {
    id: string;
    symbol: string;
    benchmark: string;
    market: string;
    status: Match['status'];
    customInfo: string;
    score?: Match['score'];
    stats?: Match['stats'];
    odds?: Match['odds'];
  },
): Match {
  const cloned = cloneMatch(base);
  return {
    ...cloned,
    id: config.id,
    league: config.market,
    status: config.status,
    homeTeam: {
      ...cloned.homeTeam,
      id: `asset_${config.symbol.toLowerCase()}`,
      name: config.symbol,
      logo: '',
      form: [],
    },
    awayTeam: {
      ...cloned.awayTeam,
      id: `benchmark_${config.benchmark.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      name: config.benchmark,
      logo: '',
      form: [],
    },
    capabilities: {
      hasStats: true,
      hasOdds: true,
      hasCustom: true,
    },
    score: config.score,
    stats: config.stats,
    odds: config.odds,
    // Reuse customInfo as local narrative source for non-sports domains.
    customInfo: config.customInfo,
  } as Match;
}

export function buildStocksLocalCases(caseMinimum: number): Match[] {
  const normalized = Math.max(3, Math.floor(caseMinimum));
  const bases = [
    MOCK_MATCHES[0] || MOCK_MATCHES[MOCK_MATCHES.length - 1],
    MOCK_MATCHES[1] || MOCK_MATCHES[0],
    MOCK_MATCHES[2] || MOCK_MATCHES[0],
  ];

  const seedCases: Match[] = [
    buildStockCase(bases[0], {
      id: 'stocks_case_1',
      symbol: 'AAPL',
      benchmark: 'NASDAQ 100',
      market: 'US Equities',
      status: 'live',
      customInfo:
        'AI cycle upside continues, but valuation crowding risk rises near event windows.',
      score: { home: 2, away: 1 },
      stats: {
        possession: { home: 61, away: 39 },
        shots: { home: 11, away: 8 },
        shotsOnTarget: { home: 6, away: 4 },
      },
      odds: {
        had: { h: 1.95, d: 3.1, a: 4.2 },
        hhad: { h: 2.9, d: 3.2, a: 2.1, goalline: -0.5 },
      },
    }),
    buildStockCase(bases[1], {
      id: 'stocks_case_2',
      symbol: 'TSLA',
      benchmark: 'S&P 500',
      market: 'US Equities',
      status: 'upcoming',
      customInfo:
        'Delivery guidance revision and policy headline risk dominate near-term positioning.',
      stats: {
        possession: { home: 52, away: 48 },
        shots: { home: 9, away: 10 },
        shotsOnTarget: { home: 4, away: 4 },
      },
      odds: {
        had: { h: 2.4, d: 3.0, a: 2.8 },
        hhad: { h: 3.6, d: 3.3, a: 1.9, goalline: 0.5 },
      },
    }),
    buildStockCase(bases[2], {
      id: 'stocks_case_3',
      symbol: 'JPM',
      benchmark: 'KBW Bank Index',
      market: 'US Financials',
      status: 'finished',
      customInfo:
        'NIM outlook and credit-cost trajectory remain the key downside trigger pair.',
      score: { home: 1, away: 0 },
      stats: {
        possession: { home: 57, away: 43 },
        shots: { home: 8, away: 6 },
        shotsOnTarget: { home: 3, away: 2 },
      },
      odds: {
        had: { h: 1.7, d: 3.6, a: 5.0 },
        hhad: { h: 2.5, d: 3.1, a: 2.5, goalline: -1 },
      },
    }),
  ];

  if (seedCases.length >= normalized) {
    return seedCases.slice(0, normalized);
  }

  const padded = [...seedCases];
  while (padded.length < normalized) {
    const source = seedCases[padded.length % seedCases.length];
    const sourceWithExtras = source as Match & Record<string, any>;
    const copy = {
      ...cloneMatch(source),
      customInfo: sourceWithExtras.customInfo,
    } as Match;
    copy.id = `stocks_case_${padded.length + 1}`;
    padded.push(copy);
  }

  return padded;
}
