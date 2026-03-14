import type { SummaryDistributionItem } from "@/src/services/analysisSummary";
import type { MatchAnalysis } from "@/src/services/ai";
import type { SubjectDisplay, SubjectDisplayStatus } from "@/src/services/subjectDisplay";

export type DomainSubjectDisplay = SubjectDisplay;
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
    subjectDisplay: DomainSubjectDisplay,
    ctx: HomePresenterContext,
    subjectSnapshot?: unknown,
  ) => HomeEntityDisplay;
  getDisplayPair?: (
    subjectDisplay: DomainSubjectDisplay,
    ctx: HomePresenterContext,
    subjectSnapshot?: unknown,
  ) => HomeEntityPair;
  getSearchTokens: (subjectDisplay: DomainSubjectDisplay, subjectSnapshot?: unknown) => string[];
  getStatusLabel: (status: SubjectDisplayStatus, ctx: HomePresenterContext) => string;
  getStatusClassName: (status: SubjectDisplayStatus) => string;
  getOutcomeLabels: (
    subjectDisplay: DomainSubjectDisplay,
    ctx: HomePresenterContext,
    subjectSnapshot?: unknown,
  ) => HomeOutcomeLabels;
  getCenterDisplay: (
    subjectDisplay: DomainSubjectDisplay,
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
    subjectDisplay: DomainSubjectDisplay,
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
    subjectDisplay: DomainSubjectDisplay,
    draftData: any | null,
    ctx: ResultPresenterContext,
    subjectSnapshot?: unknown,
  ) => DomainResultHeader;
  getSummaryHero: (
    subjectDisplay: DomainSubjectDisplay,
    draftData: any | null,
    ctx: ResultPresenterContext,
    subjectSnapshot?: unknown,
  ) => DomainResultSummaryHero;
  getSummaryDistribution: (
    analysis: MatchAnalysis | null | undefined,
    subjectDisplay: DomainSubjectDisplay,
    draftData: any | null,
    ctx: ResultPresenterContext,
    subjectSnapshot?: unknown,
  ) => SummaryDistributionItem[];
  getExportMeta: (
    subjectDisplay: DomainSubjectDisplay,
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

function buildFallbackHomeEntityDisplay(
  subjectDisplay: DomainSubjectDisplay,
): HomeEntityDisplay {
  return {
    kind: "pair",
    primary: {
      id: subjectDisplay.homeTeam.id || `${subjectDisplay.id}_primary`,
      name: subjectDisplay.homeTeam.name,
      logo: subjectDisplay.homeTeam.logo,
    },
    secondary: {
      id: subjectDisplay.awayTeam.id || `${subjectDisplay.id}_secondary`,
      name: subjectDisplay.awayTeam.name,
      logo: subjectDisplay.awayTeam.logo,
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
  subjectDisplay: DomainSubjectDisplay,
  ctx: HomePresenterContext,
  subjectSnapshot?: unknown,
): HomeEntityDisplay {
  if (typeof presenter.getEntityDisplay === "function") {
    return presenter.getEntityDisplay(subjectDisplay, ctx, subjectSnapshot);
  }
  if (typeof presenter.getDisplayPair === "function") {
    return buildHomeEntityDisplayFromPair(
      presenter.getDisplayPair(subjectDisplay, ctx, subjectSnapshot),
    );
  }
  return buildFallbackHomeEntityDisplay(subjectDisplay);
}
