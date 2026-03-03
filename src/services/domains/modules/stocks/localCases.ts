import type { Match } from "@/src/data/matches";
import { cloneMatch } from "../shared/cloneMatch";

export function buildStocksLocalCases(caseMinimum: number): Match[] {
  const now = Date.now();

  const allCases: Match[] = [
    {
      id: "s1",
      source: "local-builtin",
      league: "US Equities",
      homeTeam: {
        id: "asset_aapl",
        name: "AAPL",
        logo: "https://logo.clearbit.com/apple.com",
        form: ["+1.3%", "+0.7%", "-0.4%", "+2.2%", "+0.6%"],
      },
      awayTeam: {
        id: "benchmark_ndx",
        name: "NASDAQ 100",
        logo: "https://upload.wikimedia.org/wikipedia/commons/0/06/Nasdaq_100_logo.svg",
        form: ["+0.9%", "+0.5%", "-0.3%", "+1.6%", "+0.4%"],
      },
      date: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      status: "upcoming",
      stats: {
        possession: { home: 55, away: 45 },
        shots: { home: 84, away: 74 },
        shotsOnTarget: { home: 33, away: 26 },
      },
      capabilities: {
        hasStats: true,
        hasOdds: false,
        hasCustom: true,
      },
      customInfo: "Upcoming product launch and guidance update may re-rate the stock.",
      assetProfile: {
        symbol: "AAPL",
        assetName: "Apple Inc.",
        benchmark: "NASDAQ 100",
        sector: "Technology Hardware",
        timeframe: "1-3 months",
        marketPhase: "Post-earnings consolidation",
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
    } as Match,
    {
      id: "s2",
      source: "local-builtin",
      league: "US Equities",
      homeTeam: {
        id: "asset_tsla",
        name: "TSLA",
        logo: "https://logo.clearbit.com/tesla.com",
        form: ["-2.4%", "+1.8%", "-1.2%", "+0.6%", "-0.9%"],
      },
      awayTeam: {
        id: "benchmark_spx",
        name: "S&P 500",
        logo: "https://upload.wikimedia.org/wikipedia/commons/9/90/S%26P_500_logo.svg",
        form: ["+0.4%", "+0.3%", "-0.1%", "+0.5%", "+0.2%"],
      },
      date: new Date(now - 30 * 60 * 1000).toISOString(),
      status: "live",
      stats: {
        possession: { home: 48, away: 52 },
        shots: { home: 76, away: 82 },
        shotsOnTarget: { home: 27, away: 31 },
      },
      capabilities: {
        hasStats: true,
        hasOdds: false,
        hasCustom: true,
      },
      customInfo: "Margin pressure and policy noise are increasing intraday volatility.",
      assetProfile: {
        symbol: "TSLA",
        assetName: "Tesla Inc.",
        benchmark: "S&P 500",
        sector: "Automotive / EV",
        timeframe: "2-8 weeks",
        marketPhase: "High-volatility range",
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
    } as Match,
    {
      id: "s3",
      source: "local-builtin",
      league: "US Equities",
      homeTeam: {
        id: "asset_nvda",
        name: "NVDA",
        logo: "https://logo.clearbit.com/nvidia.com",
        form: ["+3.1%", "+2.4%", "+1.7%", "-0.5%", "+2.9%"],
      },
      awayTeam: {
        id: "benchmark_sox",
        name: "PHLX SOX",
        logo: "https://upload.wikimedia.org/wikipedia/commons/0/06/Nasdaq_100_logo.svg",
        form: ["+1.8%", "+1.2%", "+0.7%", "-0.3%", "+1.4%"],
      },
      date: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      status: "finished",
      stats: {
        possession: { home: 62, away: 38 },
        shots: { home: 92, away: 68 },
        shotsOnTarget: { home: 39, away: 24 },
      },
      capabilities: {
        hasStats: true,
        hasOdds: false,
        hasCustom: true,
      },
      customInfo: "Consensus is bullish, but crowding risk rises after sharp upside.",
      assetProfile: {
        symbol: "NVDA",
        assetName: "NVIDIA Corp.",
        benchmark: "PHLX Semiconductor Index",
        sector: "Semiconductors",
        timeframe: "1-2 quarters",
        marketPhase: "Momentum extension",
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
    } as Match,
  ];

  const count = Math.max(0, Math.floor(caseMinimum));
  return allCases.slice(0, count).map(cloneMatch);
}

