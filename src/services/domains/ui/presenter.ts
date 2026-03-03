import type { Match } from "@/src/data/matches";
import {
  getAnalysisOutcomeDistribution,
  type SummaryDistributionItem,
  type SummaryDistributionLabels,
} from "@/src/services/analysisSummary";
import type { MatchAnalysis } from "@/src/services/ai";
import type { AnalysisDomain } from "../types";

type MatchStatus = Match["status"];
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

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
  getDisplayPair: (match: Match, ctx: HomePresenterContext) => HomeEntityPair;
  getSearchTokens: (match: Match) => string[];
  getStatusLabel: (status: MatchStatus, ctx: HomePresenterContext) => string;
  getStatusClassName: (status: MatchStatus) => string;
  getOutcomeLabels: (match: Match, ctx: HomePresenterContext) => HomeOutcomeLabels;
  getCenterDisplay: (match: Match, ctx: HomePresenterContext) => HomeCenterDisplay;
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
      kind: "list";
      entities: DomainResultHeroEntity[];
    };

export interface DomainResultExportMeta {
  reportTitle: string;
  primaryEntityName: string;
  secondaryEntityName: string;
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
  ) => DomainResultHeader;
  getSummaryHero: (
    match: Match,
    draftData: any | null,
    ctx: ResultPresenterContext,
  ) => DomainResultSummaryHero;
  getSummaryDistribution: (
    analysis: MatchAnalysis | null | undefined,
    match: Match,
    draftData: any | null,
    ctx: ResultPresenterContext,
  ) => SummaryDistributionItem[];
  getExportMeta: (
    match: Match,
    draftData: any | null,
    ctx: ResultPresenterContext,
  ) => DomainResultExportMeta;
}

export interface DomainUiPresenter {
  id: string;
  home: DomainHomePresenter;
  history: DomainHistoryPresenter;
  result: DomainResultPresenter;
}

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveString(input: unknown, fallback: string): string {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : fallback;
}

function resolveFootballPair(match: Match, draftData: any | null) {
  return {
    homeName: resolveString(draftData?.homeTeam?.name, match.homeTeam.name),
    awayName: resolveString(draftData?.awayTeam?.name, match.awayTeam.name),
    homeLogo: resolveString(draftData?.homeTeam?.logo, match.homeTeam.logo),
    awayLogo: resolveString(draftData?.awayTeam?.logo, match.awayTeam.logo),
  };
}

function resolveFootballLeague(match: Match, draftData: any | null) {
  return resolveString(draftData?.league, match.league);
}

function resolveFootballStatusLabel(status: MatchStatus, t: TranslateFn): string {
  if (status === "live") return t("home.live");
  if (status === "finished") return t("home.finished");
  return t("home.upcoming");
}

const footballHomePresenter: DomainHomePresenter = {
  id: "football_home",
  useRemoteFeed: true,
  sectionTitleKey: "home.popular_matches",
  sectionHintKey: "home.live_upcoming",
  refreshActionKey: "home.refresh_matches",
  openActionKey: "home.click_to_analyze",
  noDataKey: "home.no_match_data",
  searchPlaceholderKey: "home.search_placeholder",
  getDisplayPair: (match) => ({
    primaryName: match.homeTeam.name,
    secondaryName: match.awayTeam.name,
    primaryLogo: match.homeTeam.logo,
    secondaryLogo: match.awayTeam.logo,
    connector: "VS",
  }),
  getSearchTokens: (match) => [match.homeTeam.name, match.awayTeam.name, match.league],
  getStatusLabel: (status, ctx) => resolveFootballStatusLabel(status, ctx.t),
  getStatusClassName: (status) => {
    if (status === "live") return "bg-red-500/20 text-red-500 animate-pulse";
    if (status === "finished") return "bg-zinc-800 text-zinc-400";
    return "bg-emerald-500/20 text-emerald-500";
  },
  getOutcomeLabels: (match, ctx) => ({
    homeLabel: match.homeTeam.name,
    drawLabel: ctx.t("match.draw"),
    awayLabel: match.awayTeam.name,
  }),
  getCenterDisplay: (match, ctx) => {
    if (hasNumber(match.score?.home) && hasNumber(match.score?.away)) {
      return {
        kind: "score",
        home: match.score.home,
        away: match.score.away,
      };
    }

    if (match.status === "upcoming" || match.status === "live") {
      return {
        kind: "text",
        value: ctx.formatTime(match.date),
      };
    }

    return {
      kind: "text",
      value: ctx.formatDate(match.date),
    };
  },
};

const footballHistoryPresenter: DomainHistoryPresenter = {
  id: "football_history",
  getOutcomeDistribution: (analysis, match, ctx) => {
    const labels: SummaryDistributionLabels = {
      homeLabel: match.homeTeam.name,
      drawLabel: ctx.t("match.draw"),
      awayLabel: match.awayTeam.name,
    };
    return getAnalysisOutcomeDistribution(analysis, labels);
  },
};

const footballResultPresenter: DomainResultPresenter = {
  id: "football_result",
  getLoadingContextText: () => "Loading analysis context...",
  getNotFoundText: () => "Analysis target not found",
  getHeader: (match, draftData) => {
    const pair = resolveFootballPair(match, draftData);
    return {
      subtitle: resolveFootballLeague(match, draftData),
      title: `${pair.homeName} vs ${pair.awayName}`,
    };
  },
  getSummaryHero: (match, draftData) => {
    const pair = resolveFootballPair(match, draftData);
    return {
      kind: "pair",
      primary: {
        id: match.homeTeam.id || "home",
        name: pair.homeName,
        logo: pair.homeLogo,
      },
      secondary: {
        id: match.awayTeam.id || "away",
        name: pair.awayName,
        logo: pair.awayLogo,
      },
      connector: "VS",
    };
  },
  getSummaryDistribution: (analysis, match, draftData, ctx) => {
    const pair = resolveFootballPair(match, draftData);
    const labels: SummaryDistributionLabels = {
      homeLabel: pair.homeName,
      drawLabel: ctx.t("match.draw"),
      awayLabel: pair.awayName,
    };
    return getAnalysisOutcomeDistribution(analysis, labels);
  },
  getExportMeta: (match, draftData, ctx) => {
    const pair = resolveFootballPair(match, draftData);
    return {
      reportTitle: `${pair.homeName} vs ${pair.awayName}`,
      primaryEntityName: pair.homeName,
      secondaryEntityName: pair.awayName,
      statusLabel: resolveFootballStatusLabel(match.status, ctx.t),
    };
  },
};

const FOOTBALL_DOMAIN_UI_PRESENTER: DomainUiPresenter = {
  id: "football",
  home: footballHomePresenter,
  history: footballHistoryPresenter,
  result: footballResultPresenter,
};

// DOMAIN_UI_PRESENTER_EXTENSIONS_MARKER
const BUILTIN_DOMAIN_UI_PRESENTERS: Record<string, DomainUiPresenter> = {
  football: FOOTBALL_DOMAIN_UI_PRESENTER,
  // DOMAIN_UI_PRESENTER_REGISTRATION_MARKER
};

function getFallbackDomainUiPresenter(): DomainUiPresenter {
  return BUILTIN_DOMAIN_UI_PRESENTERS.football || Object.values(BUILTIN_DOMAIN_UI_PRESENTERS)[0];
}

function assertPresenterShape(domainId: string, presenter: DomainUiPresenter) {
  if (!presenter || typeof presenter !== "object") {
    throw new Error(`Domain ${domainId} must register a valid UI presenter.`);
  }
  if (!presenter.home || typeof presenter.home.getDisplayPair !== "function") {
    throw new Error(`Domain ${domainId} must provide a home presenter contract.`);
  }
  if (!presenter.history || typeof presenter.history.getOutcomeDistribution !== "function") {
    throw new Error(`Domain ${domainId} must provide a history presenter contract.`);
  }
  if (!presenter.result || typeof presenter.result.getSummaryDistribution !== "function") {
    throw new Error(`Domain ${domainId} must provide a result presenter contract.`);
  }
}

export function assertBuiltinDomainUiPresenter(domainId: string): void {
  const presenter = BUILTIN_DOMAIN_UI_PRESENTERS[domainId];
  if (!presenter) {
    throw new Error(`Domain ${domainId} must register ui presenter contract in domains/ui/presenter.ts`);
  }
  assertPresenterShape(domainId, presenter);
}

export function getDomainUiPresenter(domain: AnalysisDomain): DomainUiPresenter {
  const presenter = BUILTIN_DOMAIN_UI_PRESENTERS[domain.id] || getFallbackDomainUiPresenter();
  assertPresenterShape(domain.id, presenter);
  return presenter;
}

export function getDomainHomePresenter(domain: AnalysisDomain): DomainHomePresenter {
  return getDomainUiPresenter(domain).home;
}

export function getDomainHistoryPresenter(domain: AnalysisDomain): DomainHistoryPresenter {
  return getDomainUiPresenter(domain).history;
}

export function getDomainResultPresenter(domain: AnalysisDomain): DomainResultPresenter {
  return getDomainUiPresenter(domain).result;
}
