import type { Match } from "@/src/data/matches";
import type { AnalysisDomain } from "@/src/services/domains/types";

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

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const sportsPresenter: DomainHomePresenter = {
  id: "sports",
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
  getStatusLabel: (status, ctx) => {
    if (status === "live") return ctx.t("home.live");
    if (status === "finished") return ctx.t("home.finished");
    return ctx.t("home.upcoming");
  },
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

export function getDomainHomePresenter(_domain: AnalysisDomain): DomainHomePresenter {
  return sportsPresenter;
}
