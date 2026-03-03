import type { Match } from "@/src/data/matches";
import type { DataSourceDefinition, SourceSelection } from "@/src/services/dataSources";
import type { AnalysisDomain, AnalysisDomainContext } from "../../types";

function hasNonEmptyObject(value: any): boolean {
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
}

function hasNonEmptyArray(value: any): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasText(value: any): boolean {
  return typeof value === "string" ? value.trim().length > 0 : false;
}

function toNumber(value: any, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function deriveAssetProfile(data: any, match: Match, importedData: any) {
  const existing = hasNonEmptyObject(data?.assetProfile)
    ? data.assetProfile
    : hasNonEmptyObject((match as any)?.assetProfile)
      ? (match as any).assetProfile
      : hasNonEmptyObject(importedData?.assetProfile)
        ? importedData.assetProfile
        : {};

  const assetSymbol = hasText(existing.symbol)
    ? String(existing.symbol).trim()
    : hasText(match?.homeTeam?.name)
      ? String(match.homeTeam.name).trim().toUpperCase()
      : "ASSET";

  const assetName = hasText(existing.assetName)
    ? String(existing.assetName).trim()
    : hasText(existing.name)
      ? String(existing.name).trim()
      : assetSymbol;

  const benchmark = hasText(existing.benchmark)
    ? String(existing.benchmark).trim()
    : hasText(match?.awayTeam?.name)
      ? String(match.awayTeam.name).trim()
      : "Market Benchmark";

  return {
    symbol: assetSymbol,
    assetName,
    benchmark,
    sector: hasText(existing.sector) ? existing.sector : "Technology",
    timeframe: hasText(existing.timeframe) ? existing.timeframe : "1-3 months",
    marketPhase: hasText(existing.marketPhase) ? existing.marketPhase : "Range with upward bias",
  };
}

function deriveMarketRegime(data: any, match: Match, importedData: any) {
  const existing = hasNonEmptyObject(data?.marketRegime)
    ? data.marketRegime
    : hasNonEmptyObject((match as any)?.marketRegime)
      ? (match as any).marketRegime
      : hasNonEmptyObject(importedData?.marketRegime)
        ? importedData.marketRegime
        : {};

  return {
    regime: hasText(existing.regime) ? existing.regime : "Late-cycle disinflation",
    ratesTrend: hasText(existing.ratesTrend) ? existing.ratesTrend : "Range-bound",
    liquidityPulse: hasText(existing.liquidityPulse) ? existing.liquidityPulse : "Neutral-to-tight",
    sentiment: hasText(existing.sentiment) ? existing.sentiment : "Crowded long growth",
  };
}

function derivePriceAction(data: any, match: Match, importedData: any) {
  const existing = hasNonEmptyObject(data?.priceAction)
    ? data.priceAction
    : hasNonEmptyObject((match as any)?.priceAction)
      ? (match as any).priceAction
      : hasNonEmptyObject(importedData?.priceAction)
        ? importedData.priceAction
        : {};

  return {
    trendScore: round1(toNumber(existing.trendScore, 58)),
    momentum14d: round1(toNumber(existing.momentum14d, 2.1)),
    volatility30d: round1(toNumber(existing.volatility30d, 22.4)),
    relativeStrength: round1(toNumber(existing.relativeStrength, 54)),
    support: round1(toNumber(existing.support, 170)),
    resistance: round1(toNumber(existing.resistance, 186)),
  };
}

function deriveValuationHealth(data: any, match: Match, importedData: any) {
  const existing = hasNonEmptyObject(data?.valuationHealth)
    ? data.valuationHealth
    : hasNonEmptyObject((match as any)?.valuationHealth)
      ? (match as any).valuationHealth
      : hasNonEmptyObject(importedData?.valuationHealth)
        ? importedData.valuationHealth
        : {};

  return {
    peRatio: round1(toNumber(existing.peRatio, 24.6)),
    revenueGrowthPct: round1(toNumber(existing.revenueGrowthPct, 8.5)),
    revisionScore: round1(toNumber(existing.revisionScore, 56)),
    freeCashFlowMarginPct: round1(toNumber(existing.freeCashFlowMarginPct, 17.2)),
  };
}

function deriveRiskEvents(data: any, match: Match, importedData: any) {
  const existing = hasNonEmptyObject(data?.riskEvents)
    ? data.riskEvents
    : hasNonEmptyObject((match as any)?.riskEvents)
      ? (match as any).riskEvents
      : hasNonEmptyObject(importedData?.riskEvents)
        ? importedData.riskEvents
        : {};

  const fallbackNarrative = (match as any)?.customInfo || importedData?.customInfo || "";
  const catalysts = hasNonEmptyArray(existing?.catalysts) ? [...existing.catalysts] : [];
  const downsideTriggers = hasNonEmptyArray(existing?.downsideTriggers)
    ? [...existing.downsideTriggers]
    : [];

  return {
    narrative: hasText(existing?.narrative) ? existing.narrative : fallbackNarrative,
    catalysts,
    downsideTriggers,
  };
}

function resolveLegacySelection(
  sourceId: string,
  previousSelection?: Partial<SourceSelection>,
): boolean | undefined {
  if (!previousSelection) return undefined;

  const aliases: Record<string, string[]> = {
    asset_profile: ["fundamental", "context", "game_context"],
    macro_regime: ["context", "fundamental"],
    price_action: ["stats", "performance_matrix"],
    valuation_health: ["market", "betting_lines"],
    risk_events: ["custom", "situational_notes", "custom_notes"],
  };

  const legacyIds = aliases[sourceId] || [];
  for (const legacyId of legacyIds) {
    const value = previousSelection[legacyId];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

const STOCKS_DATA_SOURCES: DataSourceDefinition[] = [
  {
    id: "asset_profile",
    labelKey: "Asset Profile",
    descriptionKey: "Identity and positioning of the analysis target.",
    icon: "layout",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      const { match, importedData } = ctx;
      if (data.id === undefined) data.id = match.id;
      if (data.status === undefined) data.status = match.status;
      if (data.date === undefined) data.date = match.date;
      if (data.league === undefined) data.league = match.league;

      if (!hasNonEmptyObject(data.assetProfile)) {
        data.assetProfile = deriveAssetProfile(data, match, importedData);
      }

      if (!hasNonEmptyObject(data.analysisTarget)) {
        data.analysisTarget = {
          id: data.assetProfile.symbol,
          label: data.assetProfile.assetName || data.assetProfile.symbol,
          benchmark: data.assetProfile.benchmark,
        };
      }
    },
    removeFromData: (data) => {
      delete data.id;
      delete data.status;
      delete data.date;
      delete data.league;
      delete data.assetProfile;
      delete data.analysisTarget;
    },
    formSections: [
      {
        id: "asset_identity",
        titleKey: "Asset Identity",
        columns: 2,
        fields: [
          { id: "symbol", type: "text", path: ["assetProfile", "symbol"], labelKey: "Symbol" },
          {
            id: "asset_name",
            type: "text",
            path: ["assetProfile", "assetName"],
            labelKey: "Asset Name",
          },
          {
            id: "benchmark",
            type: "text",
            path: ["assetProfile", "benchmark"],
            labelKey: "Benchmark",
          },
          {
            id: "sector",
            type: "text",
            path: ["assetProfile", "sector"],
            labelKey: "Sector",
          },
          {
            id: "timeframe",
            type: "text",
            path: ["assetProfile", "timeframe"],
            labelKey: "Time Horizon",
          },
          {
            id: "market_phase",
            type: "text",
            path: ["assetProfile", "marketPhase"],
            labelKey: "Market Phase",
          },
        ],
      },
    ],
  },
  {
    id: "macro_regime",
    labelKey: "Macro Regime",
    descriptionKey: "Rate cycle, liquidity pulse, and sentiment context.",
    icon: "layout",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      if (!hasNonEmptyObject(data.marketRegime)) {
        data.marketRegime = deriveMarketRegime(data, ctx.match, ctx.importedData);
      }
    },
    removeFromData: (data) => {
      delete data.marketRegime;
    },
    formSections: [
      {
        id: "macro_regime_context",
        titleKey: "Macro Regime",
        columns: 2,
        fields: [
          {
            id: "regime",
            type: "text",
            path: ["marketRegime", "regime"],
            labelKey: "Regime",
          },
          {
            id: "rates_trend",
            type: "text",
            path: ["marketRegime", "ratesTrend"],
            labelKey: "Rates Trend",
          },
          {
            id: "liquidity_pulse",
            type: "text",
            path: ["marketRegime", "liquidityPulse"],
            labelKey: "Liquidity Pulse",
          },
          {
            id: "sentiment",
            type: "text",
            path: ["marketRegime", "sentiment"],
            labelKey: "Sentiment",
          },
        ],
      },
    ],
  },
  {
    id: "price_action",
    labelKey: "Price Action",
    descriptionKey: "Trend, momentum, volatility, and key levels.",
    icon: "trending",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      if (!hasNonEmptyObject(data.priceAction)) {
        data.priceAction = derivePriceAction(data, ctx.match, ctx.importedData);
      }
    },
    removeFromData: (data) => {
      delete data.priceAction;
    },
    formSections: [
      {
        id: "price_action_metrics",
        titleKey: "Price Action",
        columns: 2,
        fields: [
          {
            id: "trend_score",
            type: "number",
            path: ["priceAction", "trendScore"],
            labelKey: "Trend Score (0-100)",
          },
          {
            id: "momentum_14d",
            type: "number",
            path: ["priceAction", "momentum14d"],
            labelKey: "Momentum 14D (%)",
          },
          {
            id: "volatility_30d",
            type: "number",
            path: ["priceAction", "volatility30d"],
            labelKey: "Volatility 30D (%)",
          },
          {
            id: "relative_strength",
            type: "number",
            path: ["priceAction", "relativeStrength"],
            labelKey: "Relative Strength",
          },
          {
            id: "support",
            type: "number",
            path: ["priceAction", "support"],
            labelKey: "Support Level",
          },
          {
            id: "resistance",
            type: "number",
            path: ["priceAction", "resistance"],
            labelKey: "Resistance Level",
          },
        ],
      },
    ],
  },
  {
    id: "valuation_health",
    labelKey: "Valuation Health",
    descriptionKey: "Valuation multiple, growth quality, and cash-flow health.",
    icon: "layout",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      if (!hasNonEmptyObject(data.valuationHealth)) {
        data.valuationHealth = deriveValuationHealth(data, ctx.match, ctx.importedData);
      }
    },
    removeFromData: (data) => {
      delete data.valuationHealth;
    },
    formSections: [
      {
        id: "valuation_metrics",
        titleKey: "Valuation Health",
        columns: 2,
        fields: [
          {
            id: "pe_ratio",
            type: "number",
            path: ["valuationHealth", "peRatio"],
            labelKey: "P/E Ratio",
          },
          {
            id: "revenue_growth",
            type: "number",
            path: ["valuationHealth", "revenueGrowthPct"],
            labelKey: "Revenue Growth (%)",
          },
          {
            id: "revision_score",
            type: "number",
            path: ["valuationHealth", "revisionScore"],
            labelKey: "Revision Score",
          },
          {
            id: "fcf_margin",
            type: "number",
            path: ["valuationHealth", "freeCashFlowMarginPct"],
            labelKey: "FCF Margin (%)",
          },
        ],
      },
    ],
  },
  {
    id: "risk_events",
    labelKey: "Risk Events",
    descriptionKey: "Catalysts, downside triggers, and event-driven narrative.",
    icon: "file",
    cardSpan: 2,
    isAvailable: () => true,
    defaultSelected: (ctx) =>
      hasNonEmptyObject((ctx.match as any)?.riskEvents) ||
      hasText((ctx.match as any)?.customInfo) ||
      hasNonEmptyObject(ctx.importedData?.riskEvents) ||
      hasText(ctx.importedData?.customInfo),
    applyToData: (data, ctx) => {
      if (!hasNonEmptyObject(data.riskEvents)) {
        data.riskEvents = deriveRiskEvents(data, ctx.match, ctx.importedData);
      }
      if (data.customInfo === undefined) {
        data.customInfo = data.riskEvents?.narrative || "";
      }
    },
    removeFromData: (data) => {
      delete data.riskEvents;
      delete data.customInfo;
    },
    formSections: [
      {
        id: "risk_events",
        titleKey: "Risk Events",
        fields: [
          {
            id: "risk_narrative",
            type: "textarea",
            path: ["riskEvents", "narrative"],
            placeholderKey: "match.custom_placeholder",
            rows: 4,
          },
          {
            id: "catalysts",
            type: "csv_array",
            path: ["riskEvents", "catalysts"],
            labelKey: "Catalysts",
            placeholder: "product launch, margin expansion, guidance raise",
          },
          {
            id: "downside_triggers",
            type: "csv_array",
            path: ["riskEvents", "downsideTriggers"],
            labelKey: "Downside Triggers",
            placeholder: "earnings miss, policy shock, liquidity squeeze",
          },
        ],
      },
    ],
  },
];

function resolveStocksSourceSelection(
  match: Match,
  importedData: any,
  previousSelection?: Partial<SourceSelection>,
): SourceSelection {
  const ctx: AnalysisDomainContext = { match, importedData };

  return STOCKS_DATA_SOURCES.reduce((acc, source) => {
    if (!source.isAvailable(ctx)) {
      acc[source.id] = false;
      return acc;
    }

    const prev = previousSelection?.[source.id];
    const legacyPrev = resolveLegacySelection(source.id, previousSelection);
    acc[source.id] =
      typeof prev === "boolean"
        ? prev
        : typeof legacyPrev === "boolean"
          ? legacyPrev
          : source.defaultSelected(ctx);
    return acc;
  }, {} as SourceSelection);
}

function buildStocksSourceCapabilities(data: any, selectedSources: SourceSelection) {
  const hasAssetProfile = hasNonEmptyObject(data?.assetProfile);
  const hasMarketRegime = hasNonEmptyObject(data?.marketRegime);
  const hasPriceAction = hasNonEmptyObject(data?.priceAction);
  const hasValuationHealth = hasNonEmptyObject(data?.valuationHealth);
  const hasRiskEvents = hasNonEmptyObject(data?.riskEvents);

  return {
    hasFundamental: hasAssetProfile || hasValuationHealth,
    hasStats: hasPriceAction,
    hasOdds: false,
    hasCustom: hasRiskEvents || hasText(data?.customInfo),
    hasAssetProfile: !!selectedSources.asset_profile && hasAssetProfile,
    hasMarketRegime: !!selectedSources.macro_regime && hasMarketRegime,
    hasPriceAction: !!selectedSources.price_action && hasPriceAction,
    hasValuationHealth: !!selectedSources.valuation_health && hasValuationHealth,
    hasRiskEvents: !!selectedSources.risk_events && hasRiskEvents,
  };
}

export const stocksDomain: AnalysisDomain = {
  id: "stocks",
  name: "Stocks Analysis",
  description: "Built-in stock analysis experience with technical, valuation, and risk views.",
  resources: {
    templates: [
      "stocks_basic",
      "stocks_standard",
      "stocks_risk_focused",
      "stocks_comprehensive",
    ],
    animations: ["stats-comparison"],
    agents: [
      "stocks_overview",
      "stocks_technical",
      "stocks_fundamental",
      "stocks_risk",
      "stocks_prediction",
      "stocks_general",
      "planner_template",
      "planner_autonomous",
      "tag",
      "summary",
      "animation",
    ],
    skills: ["calculator", "select_plan_template"],
  },
  dataSources: STOCKS_DATA_SOURCES,
  getAvailableDataSources: (context) =>
    STOCKS_DATA_SOURCES.filter((source) => source.isAvailable(context)),
  resolveSourceSelection: (match, importedData, previousSelection) =>
    resolveStocksSourceSelection(match, importedData, previousSelection),
  buildSourceCapabilities: buildStocksSourceCapabilities,
};