import type { Match } from "@/src/data/matches";
import type { SummaryDistributionItem } from "@/src/services/analysisSummary";
import type { MatchAnalysis } from "@/src/services/ai";

export type MatchStatus = Match["status"];
export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export interface HomePresenterContext {
  t: TranslateFn;
  formatTime: (isoDate: string) => string;
  formatDate: (isoDate: string) => string;
}

export interface HomeEntityPair {
  primaryName: string;
  secondaryName: string;
  primaryLogo: string;
  secondaryLogo: string;
  connector: string;
}

export interface HomeDisplayEntity {
  id: string;
  name: string;
  logo?: string;
  subtitle?: string;
}

export type HomeEntityDisplay =
  | {
      kind: "pair";
      primary: HomeDisplayEntity;
      secondary: HomeDisplayEntity;
      connector: string;
    }
  | {
      kind: "single";
      entity: HomeDisplayEntity;
      caption?: string;
    }
  | {
      kind: "list";
      entities: HomeDisplayEntity[];
      connector?: string;
    };

export interface HomeOutcomeLabels {
  homeLabel: string;
  drawLabel: string;
  awayLabel: string;
}

export interface HomeMetricItem {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}

export type HomeCenterDisplay =
  | {
      kind: "score";
      home: number;
      away: number;
    }
  | {
      kind: "text";
      value: string;
      tone?: "neutral" | "positive" | "negative";
    }
  | {
      kind: "metrics";
      items: HomeMetricItem[];
    };

export interface DomainHomePresenter {
  id: string;
  useRemoteFeed: boolean;
  sectionTitleKey: string;
  sectionHintKey: string;
  refreshActionKey: string;
  openActionKey: string;
  noDataKey: string;
  searchPlaceholderKey: string;
  getEntityDisplay?: (
    match: Match,
    ctx: HomePresenterContext,
    subjectSnapshot?: unknown,
  ) => HomeEntityDisplay;
  getDisplayPair?: (
    match: Match,
    ctx: HomePresenterContext,
    subjectSnapshot?: unknown,
  ) => HomeEntityPair;
  getSearchTokens: (match: Match, subjectSnapshot?: unknown) => string[];
  getStatusLabel: (status: MatchStatus, ctx: HomePresenterContext) => string;
  getStatusClassName: (status: MatchStatus) => string;
  getOutcomeLabels: (
    match: Match,
    ctx: HomePresenterContext,
    subjectSnapshot?: unknown,
  ) => HomeOutcomeLabels;
  getCenterDisplay: (
    match: Match,
    ctx: HomePresenterContext,
    subjectSnapshot?: unknown,
  ) => HomeCenterDisplay;
}

export interface HistoryPresenterContext {
  t: TranslateFn;
  language: "en" | "zh";
}

export interface DomainHistoryPresenter {
  id: string;
  getOutcomeDistribution: (
    analysis: MatchAnalysis | null | undefined,
    match: Match,
    ctx: HistoryPresenterContext,
  ) => SummaryDistributionItem[];
}

export interface ResultPresenterContext {
  t: TranslateFn;
  language: "en" | "zh";
}

export interface DomainResultHeader {
  subtitle: string;
  title: string;
}

export interface DomainResultHeroEntity {
  id: string;
  name: string;
  logo?: string;
}

export type DomainResultSummaryHero =
  | {
      kind: "none";
    }
  | {
      kind: "pair";
      primary: DomainResultHeroEntity;
      secondary: DomainResultHeroEntity;
      connector: string;
    }
  | {
      kind: "single";
      entity: DomainResultHeroEntity;
      caption?: string;
    }
  | {
      kind: "list";
      entities: DomainResultHeroEntity[];
    };

export interface DomainResultExportMeta {
  reportTitle: string;
  primaryEntityName: string;
  secondaryEntityName?: string;
  statusLabel: string;
}

export interface DomainResultPresenter {
  id: string;
  getLoadingContextText: (ctx: ResultPresenterContext) => string;
  getNotFoundText: (ctx: ResultPresenterContext) => string;
  getHeader: (
    match: Match,
    draftData: any | null,
    ctx: ResultPresenterContext,
    subjectSnapshot?: unknown,
  ) => DomainResultHeader;
  getSummaryHero: (
    match: Match,
    draftData: any | null,
    ctx: ResultPresenterContext,
    subjectSnapshot?: unknown,
  ) => DomainResultSummaryHero;
  getSummaryDistribution: (
    analysis: MatchAnalysis | null | undefined,
    match: Match,
    draftData: any | null,
    ctx: ResultPresenterContext,
    subjectSnapshot?: unknown,
  ) => SummaryDistributionItem[];
  getExportMeta: (
    match: Match,
    draftData: any | null,
    ctx: ResultPresenterContext,
    subjectSnapshot?: unknown,
  ) => DomainResultExportMeta;
}

export interface DomainUiPresenter {
  id: string;
  home: DomainHomePresenter;
  history: DomainHistoryPresenter;
  result: DomainResultPresenter;
}

function buildFallbackHomeEntityDisplay(match: Match): HomeEntityDisplay {
  return {
    kind: "pair",
    primary: {
      id: match.homeTeam.id || `${match.id}_primary`,
      name: match.homeTeam.name,
      logo: match.homeTeam.logo,
    },
    secondary: {
      id: match.awayTeam.id || `${match.id}_secondary`,
      name: match.awayTeam.name,
      logo: match.awayTeam.logo,
    },
    connector: "VS",
  };
}

export function buildHomeEntityDisplayFromPair(pair: HomeEntityPair): HomeEntityDisplay {
  return {
    kind: "pair",
    primary: {
      id: "primary",
      name: pair.primaryName,
      logo: pair.primaryLogo,
    },
    secondary: {
      id: "secondary",
      name: pair.secondaryName,
      logo: pair.secondaryLogo,
    },
    connector: pair.connector || "VS",
  };
}

export function resolveHomeEntityDisplay(
  presenter: DomainHomePresenter,
  match: Match,
  ctx: HomePresenterContext,
  subjectSnapshot?: unknown,
): HomeEntityDisplay {
  if (typeof presenter.getEntityDisplay === "function") {
    return presenter.getEntityDisplay(match, ctx, subjectSnapshot);
  }
  if (typeof presenter.getDisplayPair === "function") {
    return buildHomeEntityDisplayFromPair(
      presenter.getDisplayPair(match, ctx, subjectSnapshot),
    );
  }
  return buildFallbackHomeEntityDisplay(match);
}
