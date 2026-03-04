import type { Match } from "@/src/data/matches";
import {
  getAnalysisOutcomeDistribution,
  type SummaryDistributionLabels,
} from "@/src/services/analysisSummary";
import type {
  DomainHistoryPresenter,
  DomainHomePresenter,
  DomainResultPresenter,
  DomainUiPresenter,
  MatchStatus,
  TranslateFn,
} from "../types";

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

export function resolveFootballStatusLabel(status: MatchStatus, t: TranslateFn): string {
  if (status === "live") return t("home.live");
  if (status === "finished") return t("home.finished");
  return t("home.upcoming");
}

export const footballHomePresenter: DomainHomePresenter = {
  id: "football_home",
  useRemoteFeed: true,
  sectionTitleKey: "home.popular_matches",
  sectionHintKey: "home.live_upcoming",
  refreshActionKey: "home.refresh_matches",
  openActionKey: "home.click_to_analyze",
  noDataKey: "home.no_match_data",
  searchPlaceholderKey: "home.search_placeholder",
  getEntityDisplay: (match) => ({
    kind: "pair",
    primary: {
      id: match.homeTeam.id || `${match.id}_home`,
      name: match.homeTeam.name,
      logo: match.homeTeam.logo,
    },
    secondary: {
      id: match.awayTeam.id || `${match.id}_away`,
      name: match.awayTeam.name,
      logo: match.awayTeam.logo,
    },
    connector: "VS",
  }),
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

export const footballHistoryPresenter: DomainHistoryPresenter = {
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

export const footballResultPresenter: DomainResultPresenter = {
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

export const FOOTBALL_DOMAIN_UI_PRESENTER: DomainUiPresenter = {
  id: "football",
  home: footballHomePresenter,
  history: footballHistoryPresenter,
  result: footballResultPresenter,
};

export const DOMAIN_UI_PRESENTER_ENTRIES: DomainUiPresenter[] = [
  FOOTBALL_DOMAIN_UI_PRESENTER,
];
