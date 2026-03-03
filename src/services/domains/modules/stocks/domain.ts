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

function copyTeam(target: any, source: any) {
  if (!target || typeof target !== "object") {
    return {
      id: source?.id,
      name: source?.name,
      logo: source?.logo,
      form: Array.isArray(source?.form) ? [...source.form] : [],
    };
  }

  if (target.id === undefined) target.id = source?.id;
  if (target.name === undefined) target.name = source?.name;
  if (target.logo === undefined) target.logo = source?.logo;
  if (target.form === undefined) {
    target.form = Array.isArray(source?.form) ? [...source.form] : [];
  }

  return target;
}

function deriveAssetProfile(data: any, match: Match) {
  const existing = hasNonEmptyObject(data?.assetProfile)
    ? data.assetProfile
    : hasNonEmptyObject((match as any)?.assetProfile)
      ? (match as any).assetProfile
      : {};

  const assetSymbol = hasText(existing.symbol)
    ? String(existing.symbol).trim()
    : hasText(match?.homeTeam?.name)
      ? String(match.homeTeam.name).trim().toUpperCase()
      : "ASSET";
  const assetName = hasText(existing.assetName)
    ? String(existing.assetName).trim()
    : hasText(match?.homeTeam?.name)
      ? String(match.homeTeam.name).trim()
      : "Target Asset";
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

function derivePriceAction(data: any, match: Match) {
  const existing = hasNonEmptyObject(data?.priceAction)
    ? data.priceAction
    : hasNonEmptyObject((match as any)?.priceAction)
      ? (match as any).priceAction
      : {};
  const stats: any = hasNonEmptyObject(match?.stats) ? match.stats : {};

  const trendScore = round1(
    toNumber(existing.trendScore, 40 + toNumber(stats?.shots?.home, 70) * 0.35),
  );
  const momentum14d = round1(
    toNumber(existing.momentum14d, toNumber(stats?.possession?.home, 52) - 50),
  );
  const volatility30d = round1(
    toNumber(existing.volatility30d, 12 + Math.abs(toNumber(stats?.shotsOnTarget?.away, 25) - 25)),
  );
  const relativeStrength = round1(
    toNumber(existing.relativeStrength, 50 + toNumber(stats?.shotsOnTarget?.home, 30) * 0.8),
  );
  const support = round1(toNumber(existing.support, 170));
  const resistance = round1(toNumber(existing.resistance, 186));

  return {
    trendScore,
    momentum14d,
    volatility30d,
    relativeStrength,
    support,
    resistance,
  };
}

function deriveValuationHealth(data: any, match: Match) {
  const existing = hasNonEmptyObject(data?.valuationHealth)
    ? data.valuationHealth
    : hasNonEmptyObject((match as any)?.valuationHealth)
      ? (match as any).valuationHealth
      : {};
  const odds: any = hasNonEmptyObject(match?.odds?.had) ? match.odds?.had : {};

  return {
    peRatio: round1(toNumber(existing.peRatio, 15 + toNumber(odds?.h, 1.9) * 6)),
    revenueGrowthPct: round1(
      toNumber(existing.revenueGrowthPct, 4 + toNumber(odds?.a, 1.9) * 3),
    ),
    revisionScore: round1(toNumber(existing.revisionScore, 45 + toNumber(odds?.h, 1.9) * 18)),
    freeCashFlowMarginPct: round1(
      toNumber(existing.freeCashFlowMarginPct, 8 + toNumber(odds?.d, 2.5) * 2),
    ),
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
    labelKey: "match.fundamental_data",
    descriptionKey: "match.fundamental_desc",
    icon: "layout",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      const { match } = ctx;
      if (data.id === undefined) data.id = match.id;
      if (data.status === undefined) data.status = match.status;
      if (data.date === undefined) data.date = match.date;
      if (data.league === undefined) data.league = match.league;

      if (!hasNonEmptyObject(data.assetProfile)) {
        data.assetProfile = deriveAssetProfile(data, match);
      }

      // Keep top-level entities for current UI compatibility while enabling domain-specific payload.
      data.homeTeam = copyTeam(data.homeTeam, match.homeTeam);
      data.awayTeam = copyTeam(data.awayTeam, match.awayTeam);
    },
    removeFromData: (data) => {
      delete data.id;
      delete data.status;
      delete data.date;
      delete data.league;
      delete data.assetProfile;
      delete data.homeTeam;
      delete data.awayTeam;
    },
    formSections: [
      {
        id: "asset_identity",
        titleKey: "match.basic_info",
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
    id: "price_action",
    labelKey: "match.match_stats",
    descriptionKey: "match.fundamental_desc",
    icon: "trending",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      if (!hasNonEmptyObject(data.priceAction)) {
        data.priceAction = derivePriceAction(data, ctx.match);
      }
    },
    removeFromData: (data) => {
      delete data.priceAction;
    },
    formSections: [
      {
        id: "price_action_metrics",
        titleKey: "match.match_stats",
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
    labelKey: "match.market_data",
    descriptionKey: "match.market_desc",
    icon: "layout",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      if (!hasNonEmptyObject(data.valuationHealth)) {
        data.valuationHealth = deriveValuationHealth(data, ctx.match);
      }
    },
    removeFromData: (data) => {
      delete data.valuationHealth;
    },
    formSections: [
      {
        id: "valuation_metrics",
        titleKey: "match.market_odds",
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
    labelKey: "match.custom_data",
    descriptionKey: "match.custom_desc",
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
        titleKey: "match.custom_data",
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
  const hasPriceAction = hasNonEmptyObject(data?.priceAction);
  const hasValuationHealth = hasNonEmptyObject(data?.valuationHealth);
  const hasRiskEvents = hasNonEmptyObject(data?.riskEvents);

  return {
    hasFundamental: hasAssetProfile || hasValuationHealth,
    hasStats: hasPriceAction,
    hasOdds: false,
    hasCustom: hasRiskEvents || hasText(data?.customInfo),
    hasAssetProfile: !!selectedSources.asset_profile && hasAssetProfile,
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
