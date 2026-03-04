import type { Match } from '@/src/data/matches';
import {
  getAnalysisOutcomeDistribution,
  type SummaryDistributionLabels,
} from '@/src/services/analysisSummary';
import type {
  DomainHistoryPresenter,
  DomainHomePresenter,
  DomainResultPresenter,
  DomainUiPresenter,
  MatchStatus,
  TranslateFn,
} from '../types';

function toString(input: unknown, fallback: string): string {
  return typeof input === 'string' && input.trim().length > 0 ? input.trim() : fallback;
}

function toNumber(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isZhByTranslator(t: TranslateFn): boolean {
  const sample = t('app.title');
  return /[\u4e00-\u9fff]/.test(sample);
}

function toRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' ? (value as Record<string, any>) : null;
}

function resolveStocksStatusLabel(status: MatchStatus, t: TranslateFn): string {
  if (status === 'live') return t('stocks.status.live');
  if (status === 'finished') return t('stocks.status.finished');
  return t('stocks.status.upcoming');
}

function resolveStocksPair(match: Match, draftData: any | null) {
  const profile = draftData?.assetProfile || {};
  return {
    assetName: toString(
      profile.symbol || profile.assetName || draftData?.homeTeam?.name,
      match.homeTeam.name,
    ),
    benchmarkName: toString(profile.benchmark || draftData?.awayTeam?.name, match.awayTeam.name),
    assetLogo: toString(draftData?.homeTeam?.logo, match.homeTeam.logo),
    benchmarkLogo: toString(draftData?.awayTeam?.logo, match.awayTeam.logo),
    marketLabel: toString(draftData?.league, match.league),
  };
}

function resolveStocksBenchmarkCaption(benchmarkName: string, t: TranslateFn): string {
  return isZhByTranslator(t) ? `基准: ${benchmarkName}` : `Benchmark: ${benchmarkName}`;
}

function resolveStocksSubtitle(
  marketLabel: string,
  benchmarkName: string,
  t: TranslateFn,
): string {
  const benchmarkCaption = resolveStocksBenchmarkCaption(benchmarkName, t);
  if (!marketLabel) return benchmarkCaption;
  return `${marketLabel} · ${benchmarkCaption}`;
}

function resolveStocksOutcomeLabels(t: TranslateFn): SummaryDistributionLabels {
  if (isZhByTranslator(t)) {
    return {
      homeLabel: '看多',
      drawLabel: '中性',
      awayLabel: '看空',
    };
  }
  return {
    homeLabel: 'Bullish',
    drawLabel: 'Base',
    awayLabel: 'Bearish',
  };
}

function extractTrendSummary(match: Match, draftData: any | null) {
  const trendScore =
    toNumber(draftData?.priceAction?.trendScore) ?? toNumber(match.stats?.possession?.home);
  const momentum = toNumber(draftData?.priceAction?.momentum14d);
  const volatility =
    toNumber(draftData?.priceAction?.volatility30d) ?? toNumber(match.stats?.shots?.away);

  if (trendScore == null && momentum == null && volatility == null) {
    return null;
  }

  return {
    trendScore: trendScore == null ? null : Math.max(0, Math.min(100, Math.round(trendScore))),
    momentum,
    volatility,
  };
}

export const stocksHomePresenter: DomainHomePresenter = {
  id: 'stocks_home',
  useRemoteFeed: true,
  sectionTitleKey: 'stocks.home.section_title',
  sectionHintKey: 'stocks.home.section_hint',
  refreshActionKey: 'stocks.home.refresh_action',
  openActionKey: 'stocks.home.open_action',
  noDataKey: 'stocks.home.no_data',
  searchPlaceholderKey: 'stocks.home.search_placeholder',
  getEntityDisplay: (match, ctx, subjectSnapshot) => {
    const snapshot = toRecord(subjectSnapshot);
    const pair = resolveStocksPair(match, snapshot);
    return {
      kind: 'single',
      entity: {
        id: match.homeTeam.id || `${match.id}_asset`,
        name: pair.assetName,
        logo: pair.assetLogo,
      },
      caption: resolveStocksBenchmarkCaption(pair.benchmarkName, ctx.t),
    };
  },
  getSearchTokens: (match, subjectSnapshot) => {
    const snapshot = toRecord(subjectSnapshot);
    const pair = resolveStocksPair(match, snapshot);
    const sector = toString(snapshot?.assetProfile?.sector, '');
    return [pair.assetName, pair.benchmarkName, pair.marketLabel, sector];
  },
  getStatusLabel: (status, ctx) => resolveStocksStatusLabel(status, ctx.t),
  getStatusClassName: (status) => {
    if (status === 'live') return 'bg-red-500/20 text-red-500 animate-pulse';
    if (status === 'finished') return 'bg-zinc-800 text-zinc-400';
    return 'bg-emerald-500/20 text-emerald-500';
  },
  getOutcomeLabels: (_match, ctx) => {
    const labels = resolveStocksOutcomeLabels(ctx.t);
    return {
      homeLabel: labels.homeLabel || 'Bullish',
      drawLabel: labels.drawLabel || 'Base',
      awayLabel: labels.awayLabel || 'Bearish',
    };
  },
  getCenterDisplay: (match, ctx, subjectSnapshot) => {
    const snapshot = toRecord(subjectSnapshot);
    const trend = extractTrendSummary(match, snapshot);
    if (trend) {
      return {
        kind: 'metrics',
        items: [
          {
            label: 'Trend',
            value: trend.trendScore == null ? '--' : `${trend.trendScore}`,
            tone:
              trend.trendScore == null
                ? 'neutral'
                : trend.trendScore >= 60
                  ? 'positive'
                  : trend.trendScore <= 40
                    ? 'negative'
                    : 'neutral',
          },
          {
            label: 'Vol',
            value: trend.volatility == null ? '--' : `${trend.volatility.toFixed(1)}`,
            tone: 'neutral',
          },
          {
            label: 'Mom',
            value: trend.momentum == null ? '--' : `${trend.momentum.toFixed(1)}`,
            tone:
              trend.momentum == null
                ? 'neutral'
                : trend.momentum >= 0
                  ? 'positive'
                  : 'negative',
          },
        ],
      };
    }

    if (match.status === 'upcoming' || match.status === 'live') {
      return { kind: 'text', value: isZhByTranslator(ctx.t) ? '跟踪中' : 'Tracking' };
    }

    return { kind: 'text', value: isZhByTranslator(ctx.t) ? '快照' : 'Snapshot' };
  },
};

export const stocksHistoryPresenter: DomainHistoryPresenter = {
  id: 'stocks_history',
  getOutcomeDistribution: (analysis, _match, ctx) => {
    return getAnalysisOutcomeDistribution(analysis, resolveStocksOutcomeLabels(ctx.t));
  },
};

export const stocksResultPresenter: DomainResultPresenter = {
  id: 'stocks_result',
  getLoadingContextText: (ctx) =>
    isZhByTranslator(ctx.t) ? '正在加载分析上下文...' : 'Loading analysis context...',
  getNotFoundText: (ctx) =>
    isZhByTranslator(ctx.t) ? '未找到分析对象' : 'Analysis target not found',
  getHeader: (match, draftData, ctx) => {
    const pair = resolveStocksPair(match, draftData);
    return {
      subtitle: resolveStocksSubtitle(pair.marketLabel, pair.benchmarkName, ctx.t),
      title: pair.assetName,
    };
  },
  getSummaryHero: (match, draftData, ctx) => {
    const pair = resolveStocksPair(match, draftData);
    return {
      kind: 'single',
      entity: {
        id: match.homeTeam.id || 'asset',
        name: pair.assetName,
        logo: pair.assetLogo,
      },
      caption: resolveStocksBenchmarkCaption(pair.benchmarkName, ctx.t),
    };
  },
  getSummaryDistribution: (analysis, _match, _draftData, ctx) =>
    getAnalysisOutcomeDistribution(analysis, resolveStocksOutcomeLabels(ctx.t)),
  getExportMeta: (match, draftData, ctx) => {
    const pair = resolveStocksPair(match, draftData);
    const reportTitle = isZhByTranslator(ctx.t)
      ? `${pair.assetName}（基准：${pair.benchmarkName}）`
      : `${pair.assetName} (Benchmark: ${pair.benchmarkName})`;

    return {
      reportTitle,
      primaryEntityName: pair.assetName,
      secondaryEntityName: pair.benchmarkName,
      statusLabel: resolveStocksStatusLabel(match.status, ctx.t),
    };
  },
};

export const STOCKS_DOMAIN_UI_PRESENTER: DomainUiPresenter = {
  id: 'stocks',
  home: stocksHomePresenter,
  history: stocksHistoryPresenter,
  result: stocksResultPresenter,
};

export const DOMAIN_UI_PRESENTER_ENTRIES: DomainUiPresenter[] = [
  STOCKS_DOMAIN_UI_PRESENTER,
];

