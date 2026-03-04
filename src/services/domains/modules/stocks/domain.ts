import type { Match } from '@/src/data/matches';
import type {
  AnalysisDomain,
  AnalysisDomainContext,
} from '../../types';
import type {
  DataSourceDefinition,
  SourceSelection,
} from '@/src/services/dataSources';

type StocksAssetProfile = {
  symbol: string;
  assetName: string;
  benchmark: string;
  sector: string;
  timeframe: string;
  marketPhase: string;
};

type StocksPriceAction = {
  trendScore: number;
  momentum14d: number;
  volatility30d: number;
  relativeStrength: number;
  support: number;
  resistance: number;
};

type StocksValuationHealth = {
  peRatio: number;
  revenueGrowthPct: number;
  revisionScore: number;
  freeCashFlowMarginPct: number;
};

type StocksRiskEvents = {
  narrative: string;
  catalysts: string[];
  downsideTriggers: string[];
};

const STOCKS_DOMAIN_META = {
  id: 'stocks',
};

function hasNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function readExtendedField(ctx: AnalysisDomainContext, key: string): any {
  const imported = ctx.importedData && typeof ctx.importedData === 'object'
    ? (ctx.importedData as Record<string, any>)[key]
    : undefined;
  if (imported !== undefined) return imported;

  const matchRecord = ctx.match as Match & Record<string, any>;
  return matchRecord[key];
}

function buildDefaultAssetProfile(match: Match): StocksAssetProfile {
  const symbol = toString(match.homeTeam?.name, 'ASSET');
  const benchmark = toString(match.awayTeam?.name, 'Benchmark');
  return {
    symbol,
    assetName: symbol,
    benchmark,
    sector: toString(match.league, 'Multi-Sector'),
    timeframe: '1-3 months',
    marketPhase: match.status === 'live' ? 'In-session repricing' : 'Positioning window',
  };
}

function buildDefaultPriceAction(match: Match): StocksPriceAction {
  const stats = match.stats;
  const momentumBase = toNumber(stats?.possession?.home, 52);
  const volatilityBase = toNumber(stats?.shots?.away, 18);
  const relativeBase = toNumber(stats?.shotsOnTarget?.home, 55);
  const trendScore = Math.max(0, Math.min(100, Math.round(momentumBase)));

  return {
    trendScore,
    momentum14d: Number(((momentumBase - 50) / 5).toFixed(1)),
    volatility30d: Number((Math.max(8, volatilityBase * 1.4)).toFixed(1)),
    relativeStrength: Math.max(0, Math.min(100, Math.round(relativeBase * 9))),
    support: Number((100 + momentumBase * 0.6).toFixed(2)),
    resistance: Number((106 + momentumBase * 0.7).toFixed(2)),
  };
}

function buildDefaultValuationHealth(match: Match): StocksValuationHealth {
  const odds = match.odds?.had;
  const basePe = odds ? 12 + toNumber(odds.h, 1.8) * 8 : 24;
  const growth = odds ? 6 + toNumber(odds.d, 2.8) : 8;
  const revision = odds ? 45 + Math.round((1 / Math.max(0.3, toNumber(odds.a, 3))) * 18) : 58;
  const fcf = odds ? 12 + toNumber(odds.h, 1.8) * 4 : 16;

  return {
    peRatio: Number(basePe.toFixed(1)),
    revenueGrowthPct: Number(growth.toFixed(1)),
    revisionScore: Math.max(0, Math.min(100, revision)),
    freeCashFlowMarginPct: Number(fcf.toFixed(1)),
  };
}

function buildDefaultRiskEvents(match: Match): StocksRiskEvents {
  const customInfo = (match as Match & Record<string, any>).customInfo;
  const narrative = hasNonEmptyString(customInfo)
    ? customInfo
    : `${match.homeTeam.name} faces execution and valuation balance risk versus ${match.awayTeam.name}.`;

  return {
    narrative,
    catalysts: ['Guidance update', 'Policy signal'],
    downsideTriggers: ['Demand miss', 'Margin compression'],
  };
}

const STOCKS_DATA_SOURCES: DataSourceDefinition[] = [
  {
    id: 'asset_profile',
    labelKey: 'stocks.sources.asset_profile.label',
    descriptionKey: 'stocks.sources.asset_profile.description',
    icon: 'layout',
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      const external = readExtendedField(ctx, 'assetProfile');
      const fallback = buildDefaultAssetProfile(ctx.match);
      data.assetProfile = hasNonEmptyObject(external)
        ? { ...fallback, ...external }
        : fallback;
    },
    removeFromData: (data) => {
      delete data.assetProfile;
    },
    formSections: [
      {
        id: 'stocks_asset_profile',
        titleKey: 'stocks.sections.asset_profile',
        fields: [
          {
            id: 'symbol',
            type: 'text',
            path: ['assetProfile', 'symbol'],
            labelKey: 'stocks.fields.symbol',
            placeholderKey: 'stocks.placeholders.symbol',
          },
          {
            id: 'asset_name',
            type: 'text',
            path: ['assetProfile', 'assetName'],
            labelKey: 'stocks.fields.asset_name',
            placeholderKey: 'stocks.placeholders.asset_name',
          },
          {
            id: 'benchmark',
            type: 'text',
            path: ['assetProfile', 'benchmark'],
            labelKey: 'stocks.fields.benchmark',
            placeholderKey: 'stocks.placeholders.benchmark',
          },
          {
            id: 'sector',
            type: 'text',
            path: ['assetProfile', 'sector'],
            labelKey: 'stocks.fields.sector',
            placeholderKey: 'stocks.placeholders.sector',
          },
          {
            id: 'timeframe',
            type: 'text',
            path: ['assetProfile', 'timeframe'],
            labelKey: 'stocks.fields.timeframe',
            placeholderKey: 'stocks.placeholders.timeframe',
          },
          {
            id: 'market_phase',
            type: 'text',
            path: ['assetProfile', 'marketPhase'],
            labelKey: 'stocks.fields.market_phase',
            placeholderKey: 'stocks.placeholders.market_phase',
          },
        ],
      },
    ],
  },
  {
    id: 'price_action',
    labelKey: 'stocks.sources.price_action.label',
    descriptionKey: 'stocks.sources.price_action.description',
    icon: 'trending',
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      const external = readExtendedField(ctx, 'priceAction');
      const fallback = buildDefaultPriceAction(ctx.match);
      data.priceAction = hasNonEmptyObject(external)
        ? { ...fallback, ...external }
        : fallback;
    },
    removeFromData: (data) => {
      delete data.priceAction;
    },
    formSections: [
      {
        id: 'stocks_price_action',
        titleKey: 'stocks.sections.price_action',
        columns: 2,
        fields: [
          {
            id: 'trend_score',
            type: 'number',
            path: ['priceAction', 'trendScore'],
            labelKey: 'stocks.fields.trend_score',
          },
          {
            id: 'relative_strength',
            type: 'number',
            path: ['priceAction', 'relativeStrength'],
            labelKey: 'stocks.fields.relative_strength',
          },
          {
            id: 'momentum_14d',
            type: 'number',
            path: ['priceAction', 'momentum14d'],
            labelKey: 'stocks.fields.momentum_14d',
          },
          {
            id: 'volatility_30d',
            type: 'number',
            path: ['priceAction', 'volatility30d'],
            labelKey: 'stocks.fields.volatility_30d',
          },
          {
            id: 'support',
            type: 'number',
            path: ['priceAction', 'support'],
            labelKey: 'stocks.fields.support',
          },
          {
            id: 'resistance',
            type: 'number',
            path: ['priceAction', 'resistance'],
            labelKey: 'stocks.fields.resistance',
          },
        ],
      },
    ],
  },
  {
    id: 'valuation_health',
    labelKey: 'stocks.sources.valuation_health.label',
    descriptionKey: 'stocks.sources.valuation_health.description',
    icon: 'layout',
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      const external = readExtendedField(ctx, 'valuationHealth');
      const fallback = buildDefaultValuationHealth(ctx.match);
      data.valuationHealth = hasNonEmptyObject(external)
        ? { ...fallback, ...external }
        : fallback;
    },
    removeFromData: (data) => {
      delete data.valuationHealth;
    },
    formSections: [
      {
        id: 'stocks_valuation_health',
        titleKey: 'stocks.sections.valuation_health',
        columns: 2,
        fields: [
          {
            id: 'pe_ratio',
            type: 'number',
            path: ['valuationHealth', 'peRatio'],
            labelKey: 'stocks.fields.pe_ratio',
          },
          {
            id: 'revenue_growth_pct',
            type: 'number',
            path: ['valuationHealth', 'revenueGrowthPct'],
            labelKey: 'stocks.fields.revenue_growth_pct',
          },
          {
            id: 'revision_score',
            type: 'number',
            path: ['valuationHealth', 'revisionScore'],
            labelKey: 'stocks.fields.revision_score',
          },
          {
            id: 'free_cash_flow_margin_pct',
            type: 'number',
            path: ['valuationHealth', 'freeCashFlowMarginPct'],
            labelKey: 'stocks.fields.free_cash_flow_margin_pct',
          },
        ],
      },
    ],
  },
  {
    id: 'risk_events',
    labelKey: 'stocks.sources.risk_events.label',
    descriptionKey: 'stocks.sources.risk_events.description',
    icon: 'file',
    cardSpan: 2,
    isAvailable: () => true,
    defaultSelected: (ctx) => {
      const riskEvents = readExtendedField(ctx, 'riskEvents');
      if (hasNonEmptyObject(riskEvents)) return true;
      return hasNonEmptyString((ctx.match as Match & Record<string, any>).customInfo);
    },
    applyToData: (data, ctx) => {
      const external = readExtendedField(ctx, 'riskEvents');
      const fallback = buildDefaultRiskEvents(ctx.match);
      const merged = hasNonEmptyObject(external) ? { ...fallback, ...external } : fallback;
      merged.catalysts = toStringArray(merged.catalysts);
      merged.downsideTriggers = toStringArray(merged.downsideTriggers);
      data.riskEvents = merged;
    },
    removeFromData: (data) => {
      delete data.riskEvents;
    },
    formSections: [
      {
        id: 'stocks_risk_events',
        titleKey: 'stocks.sections.risk_events',
        fields: [
          {
            id: 'narrative',
            type: 'textarea',
            path: ['riskEvents', 'narrative'],
            labelKey: 'stocks.fields.risk_narrative',
            placeholderKey: 'stocks.placeholders.risk_narrative',
            rows: 4,
          },
          {
            id: 'catalysts',
            type: 'csv_array',
            path: ['riskEvents', 'catalysts'],
            labelKey: 'stocks.fields.catalysts',
            placeholderKey: 'stocks.placeholders.catalysts',
          },
          {
            id: 'downside_triggers',
            type: 'csv_array',
            path: ['riskEvents', 'downsideTriggers'],
            labelKey: 'stocks.fields.downside_triggers',
            placeholderKey: 'stocks.placeholders.downside_triggers',
          },
        ],
      },
    ],
  },
];

export function resolveStocksSourceSelection(
  match: Match,
  importedData?: any,
  previousSelection?: Partial<SourceSelection>,
): SourceSelection {
  const context: AnalysisDomainContext = { match, importedData };
  return STOCKS_DATA_SOURCES.reduce((acc, source) => {
    if (!source.isAvailable(context)) {
      acc[source.id] = false;
      return acc;
    }
    const previous = previousSelection?.[source.id];
    acc[source.id] = typeof previous === 'boolean' ? previous : source.defaultSelected(context);
    return acc;
  }, {} as SourceSelection);
}

export function buildStocksSourceCapabilities(data: any, selectedSources: SourceSelection) {
  const hasAssetProfile =
    !!selectedSources.asset_profile && hasNonEmptyObject(data?.assetProfile);
  const hasPriceAction =
    !!selectedSources.price_action && hasNonEmptyObject(data?.priceAction);
  const hasValuationHealth =
    !!selectedSources.valuation_health && hasNonEmptyObject(data?.valuationHealth);
  const hasRiskEvents =
    !!selectedSources.risk_events && hasNonEmptyObject(data?.riskEvents);

  // Keep legacy flags for compatibility with shared orchestration paths.
  const hasFundamental = hasAssetProfile || hasValuationHealth;
  const hasStats = hasPriceAction;
  const hasOdds = false;
  const hasCustom = hasRiskEvents || hasNonEmptyString(data?.customInfo);

  return {
    hasAssetProfile,
    hasPriceAction,
    hasValuationHealth,
    hasRiskEvents,
    hasFundamental,
    hasStats,
    hasOdds,
    hasCustom,
  };
}

export const stocksDomain: AnalysisDomain = {
  id: STOCKS_DOMAIN_META.id,
  name: 'Stocks Analysis',
  description: 'Built-in equity analysis domain for asset, valuation, and event-driven risk.',
  resources: {
    templates: [
      'stocks_basic',
      'stocks_standard',
      'stocks_risk_focused',
      'stocks_comprehensive',
    ],
    animations: ['stats-comparison'],
    agents: [
      'stocks_overview',
      'stocks_technical',
      'stocks_fundamental',
      'stocks_risk',
      'stocks_prediction',
      'stocks_general',
      'stocks_planner_template',
      'stocks_planner_autonomous',
      'tag',
      'summary',
      'animation',
    ],
    skills: ['calculator', 'select_plan_template'],
  },
  dataSources: STOCKS_DATA_SOURCES,
  getAvailableDataSources: (context) =>
    STOCKS_DATA_SOURCES.filter((source) => source.isAvailable(context)),
  resolveSourceSelection: (match, importedData, previousSelection) =>
    resolveStocksSourceSelection(match, importedData, previousSelection),
  buildSourceCapabilities: buildStocksSourceCapabilities,
};
