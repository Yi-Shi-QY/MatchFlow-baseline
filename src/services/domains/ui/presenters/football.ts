import {
  getAnalysisOutcomeDistribution,
  type SummaryDistributionLabels,
} from "@/src/services/analysisSummary";
import type {
  DomainSubjectDisplay,
  DomainHistoryPresenter,
  DomainHomePresenter,
  DomainResultPresenter,
  DomainUiPresenter,
  TranslateFn,
} from "../types";
import type { SubjectDisplayStatus } from "@/src/services/subjectDisplayMatch";

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveString(input: unknown, fallback: string): string {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : fallback;
}

function resolveFootballPair(subjectDisplay: DomainSubjectDisplay, draftData: any | null) {
  return {
    homeName: resolveString(draftData?.homeTeam?.name, subjectDisplay.homeTeam.name),
    awayName: resolveString(draftData?.awayTeam?.name, subjectDisplay.awayTeam.name),
    homeLogo: resolveString(draftData?.homeTeam?.logo, subjectDisplay.homeTeam.logo),
    awayLogo: resolveString(draftData?.awayTeam?.logo, subjectDisplay.awayTeam.logo),
  };
}

function resolveFootballLeague(subjectDisplay: DomainSubjectDisplay, draftData: any | null) {
  return resolveString(draftData?.league, subjectDisplay.league);
}

export function resolveFootballStatusLabel(
  status: SubjectDisplayStatus,
  t: TranslateFn,
): string {
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
  getEntityDisplay: (subjectDisplay) => ({
    kind: "pair",
    primary: {
      id: subjectDisplay.homeTeam.id || `${subjectDisplay.id}_home`,
      name: subjectDisplay.homeTeam.name,
      logo: subjectDisplay.homeTeam.logo,
    },
    secondary: {
      id: subjectDisplay.awayTeam.id || `${subjectDisplay.id}_away`,
      name: subjectDisplay.awayTeam.name,
      logo: subjectDisplay.awayTeam.logo,
    },
    connector: "VS",
  }),
  getDisplayPair: (subjectDisplay) => ({
    primaryName: subjectDisplay.homeTeam.name,
    secondaryName: subjectDisplay.awayTeam.name,
    primaryLogo: subjectDisplay.homeTeam.logo,
    secondaryLogo: subjectDisplay.awayTeam.logo,
    connector: "VS",
  }),
  getSearchTokens: (subjectDisplay) => [
    subjectDisplay.homeTeam.name,
    subjectDisplay.awayTeam.name,
    subjectDisplay.league,
  ],
  getStatusLabel: (status, ctx) => resolveFootballStatusLabel(status, ctx.t),
  getStatusClassName: (status) => {
    if (status === "live") return "bg-red-500/20 text-red-500 animate-pulse";
    if (status === "finished") {
      return "bg-[var(--mf-surface)] border border-[var(--mf-border)] text-[var(--mf-text-muted)]";
    }
    return "bg-[var(--mf-accent-soft)] text-[var(--mf-accent)]";
  },
  getOutcomeLabels: (subjectDisplay, ctx) => ({
    homeLabel: subjectDisplay.homeTeam.name,
    drawLabel: ctx.t("match.draw"),
    awayLabel: subjectDisplay.awayTeam.name,
  }),
  getCenterDisplay: (subjectDisplay, ctx) => {
    if (hasNumber(subjectDisplay.score?.home) && hasNumber(subjectDisplay.score?.away)) {
      return {
        kind: "score",
        home: subjectDisplay.score.home,
        away: subjectDisplay.score.away,
      };
    }

    if (subjectDisplay.status === "upcoming" || subjectDisplay.status === "live") {
      return {
        kind: "text",
        value: ctx.formatTime(subjectDisplay.date),
      };
    }

    return {
      kind: "text",
      value: ctx.formatDate(subjectDisplay.date),
    };
  },
};

export const footballHistoryPresenter: DomainHistoryPresenter = {
  id: "football_history",
  getOutcomeDistribution: (analysis, subjectDisplay, ctx) => {
    const labels: SummaryDistributionLabels = {
      homeLabel: subjectDisplay.homeTeam.name,
      drawLabel: ctx.t("match.draw"),
      awayLabel: subjectDisplay.awayTeam.name,
    };
    return getAnalysisOutcomeDistribution(analysis, labels);
  },
};

export const footballResultPresenter: DomainResultPresenter = {
  id: "football_result",
  getLoadingContextText: () => "Loading analysis context...",
  getNotFoundText: () => "Analysis target not found",
  getHeader: (subjectDisplay, draftData) => {
    const pair = resolveFootballPair(subjectDisplay, draftData);
    return {
      subtitle: resolveFootballLeague(subjectDisplay, draftData),
      title: `${pair.homeName} vs ${pair.awayName}`,
    };
  },
  getSummaryHero: (subjectDisplay, draftData) => {
    const pair = resolveFootballPair(subjectDisplay, draftData);
    return {
      kind: "pair",
      primary: {
        id: subjectDisplay.homeTeam.id || "home",
        name: pair.homeName,
        logo: pair.homeLogo,
      },
      secondary: {
        id: subjectDisplay.awayTeam.id || "away",
        name: pair.awayName,
        logo: pair.awayLogo,
      },
      connector: "VS",
    };
  },
  getSummaryDistribution: (analysis, subjectDisplay, draftData, ctx) => {
    const pair = resolveFootballPair(subjectDisplay, draftData);
    const labels: SummaryDistributionLabels = {
      homeLabel: pair.homeName,
      drawLabel: ctx.t("match.draw"),
      awayLabel: pair.awayName,
    };
    return getAnalysisOutcomeDistribution(analysis, labels);
  },
  getExportMeta: (subjectDisplay, draftData, ctx) => {
    const pair = resolveFootballPair(subjectDisplay, draftData);
    return {
      reportTitle: `${pair.homeName} vs ${pair.awayName}`,
      primaryEntityName: pair.homeName,
      secondaryEntityName: pair.awayName,
      statusLabel: resolveFootballStatusLabel(subjectDisplay.status, ctx.t),
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
