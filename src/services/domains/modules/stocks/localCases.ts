import type { Match } from "@/src/data/matches";
import { cloneMatch } from "../shared/cloneMatch";

interface StocksCaseSeed {
  id: string;
  symbol: string;
  assetName: string;
  benchmark: string;
  sector: string;
  timeframe: string;
  marketPhase: string;
  date: string;
  status: "upcoming" | "live" | "finished";
  marketRegime: {
    regime: string;
    ratesTrend: string;
    liquidityPulse: string;
    sentiment: string;
  };
  priceAction: {
    trendScore: number;
    momentum14d: number;
    volatility30d: number;
    relativeStrength: number;
    support: number;
    resistance: number;
  };
  valuationHealth: {
    peRatio: number;
    revenueGrowthPct: number;
    revisionScore: number;
    freeCashFlowMarginPct: number;
  };
  riskEvents: {
    narrative: string;
    catalysts: string[];
    downsideTriggers: string[];
  };
}

function toStockShell(seed: StocksCaseSeed): Match {
  const symbolLower = seed.symbol.toLowerCase();
  const benchmarkId = seed.benchmark.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  // Keep only a minimal UI shell while analysis payload is stock-native.
  return {
    id: seed.id,
    source: "local-builtin",
    league: "US Equities",
    date: seed.date,
    status: seed.status,
    homeTeam: {
      id: `asset_${symbolLower}`,
      name: seed.symbol,
      logo: `https://logo.clearbit.com/${symbolLower}.com`,
      form: [],
    },
    awayTeam: {
      id: `benchmark_${benchmarkId}`,
      name: seed.benchmark,
      logo: "https://upload.wikimedia.org/wikipedia/commons/0/06/Nasdaq_100_logo.svg",
      form: [],
    },
    capabilities: {
      hasStats: true,
      hasOdds: false,
      hasCustom: true,
    },
    customInfo: seed.riskEvents.narrative,
    assetProfile: {
      symbol: seed.symbol,
      assetName: seed.assetName,
      benchmark: seed.benchmark,
      sector: seed.sector,
      timeframe: seed.timeframe,
      marketPhase: seed.marketPhase,
    },
    marketRegime: seed.marketRegime,
    priceAction: seed.priceAction,
    valuationHealth: seed.valuationHealth,
    riskEvents: seed.riskEvents,
  } as Match;
}

export function buildStocksLocalCases(caseMinimum: number): Match[] {
  const now = Date.now();

  const seeds: StocksCaseSeed[] = [
    {
      id: "s1",
      symbol: "AAPL",
      assetName: "Apple Inc.",
      benchmark: "NASDAQ 100",
      sector: "Technology Hardware",
      timeframe: "1-3 months",
      marketPhase: "Post-earnings consolidation",
      date: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      status: "upcoming",
      marketRegime: {
        regime: "Disinflation with selective growth leadership",
        ratesTrend: "Range-bound",
        liquidityPulse: "Neutral",
        sentiment: "Constructive but crowded",
      },
      priceAction: {
        trendScore: 71,
        momentum14d: 4.2,
        volatility30d: 19.6,
        relativeStrength: 63,
        support: 176.5,
        resistance: 189.0,
      },
      valuationHealth: {
        peRatio: 28.4,
        revenueGrowthPct: 7.8,
        revisionScore: 61,
        freeCashFlowMarginPct: 24.1,
      },
      riskEvents: {
        narrative: "AI device cycle upside vs valuation crowding risk.",
        catalysts: ["AI product event", "Buyback acceleration"],
        downsideTriggers: ["Demand miss", "Gross margin compression"],
      },
    },
    {
      id: "s2",
      symbol: "TSLA",
      assetName: "Tesla Inc.",
      benchmark: "S&P 500",
      sector: "Automotive / EV",
      timeframe: "2-8 weeks",
      marketPhase: "High-volatility range",
      date: new Date(now - 30 * 60 * 1000).toISOString(),
      status: "live",
      marketRegime: {
        regime: "Policy-sensitive risk-on/off rotation",
        ratesTrend: "Upward drift",
        liquidityPulse: "Tightening",
        sentiment: "Two-way with headline spikes",
      },
      priceAction: {
        trendScore: 43,
        momentum14d: -3.6,
        volatility30d: 31.2,
        relativeStrength: 38,
        support: 168.0,
        resistance: 192.5,
      },
      valuationHealth: {
        peRatio: 58.7,
        revenueGrowthPct: 11.4,
        revisionScore: 34,
        freeCashFlowMarginPct: 8.7,
      },
      riskEvents: {
        narrative: "Event-driven tape with wide scenario spread.",
        catalysts: ["FSD rollout update", "Energy storage orders"],
        downsideTriggers: ["Pricing war escalation", "Regulatory headlines"],
      },
    },
    {
      id: "s3",
      symbol: "NVDA",
      assetName: "NVIDIA Corp.",
      benchmark: "PHLX SOX",
      sector: "Semiconductors",
      timeframe: "1-2 quarters",
      marketPhase: "Momentum extension",
      date: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      status: "finished",
      marketRegime: {
        regime: "AI capex super-cycle narrative",
        ratesTrend: "Stable-to-lower",
        liquidityPulse: "Supportive",
        sentiment: "Very bullish, crowding elevated",
      },
      priceAction: {
        trendScore: 84,
        momentum14d: 9.1,
        volatility30d: 27.5,
        relativeStrength: 79,
        support: 821.0,
        resistance: 918.0,
      },
      valuationHealth: {
        peRatio: 46.2,
        revenueGrowthPct: 39.5,
        revisionScore: 78,
        freeCashFlowMarginPct: 31.4,
      },
      riskEvents: {
        narrative: "Strong demand trend with valuation-sensitive downside tail.",
        catalysts: ["Data center demand surprise", "Supply chain normalization"],
        downsideTriggers: ["Capex pullback", "Export restriction shock"],
      },
    },
  ];

  const count = Math.max(0, Math.floor(caseMinimum));
  return seeds.slice(0, count).map(toStockShell).map(cloneMatch);
}