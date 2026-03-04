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

function toString(input: unknown, fallback: string): string {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : fallback;
}

function toNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isZhByTranslator(t: TranslateFn): boolean {
  const sample = t("app.title");
  return /[\u4e00-\u9fff]/.test(sample);
}

function toRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" ? (value as Record<string, any>) : null;
}

function resolveStatusLabel(status: MatchStatus, t: TranslateFn): string {
  if (status === "live") return t("fengshui.status.live");
  if (status === "finished") return t("fengshui.status.finished");
  return t("fengshui.status.upcoming");
}

function resolveOutcomeLabels(t: TranslateFn): SummaryDistributionLabels {
  if (isZhByTranslator(t)) {
    return {
      homeLabel: "顺势",
      drawLabel: "平衡",
      awayLabel: "谨慎",
    };
  }
  return {
    homeLabel: "Aligned",
    drawLabel: "Balanced",
    awayLabel: "Cautious",
  };
}

function resolveEntity(match: Match, draftData: any | null) {
  const profile = draftData?.siteProfile || {};
  const subjectName = toString(
    profile.subjectName || draftData?.homeTeam?.name,
    match.homeTeam.name,
  );
  const referenceName = toString(
    profile.referenceFrame || draftData?.awayTeam?.name,
    match.awayTeam.name,
  );
  const propertyType = toString(profile.propertyType, "");
  const facingDirection = toString(profile.facingDirection, "");
  const subtitle = [propertyType, facingDirection].filter((item) => item.length > 0).join(" · ");

  return {
    primaryName: subjectName,
    secondaryName: referenceName,
    primaryLogo: toString(draftData?.homeTeam?.logo, match.homeTeam.logo),
    subtitle: subtitle || toString(draftData?.league, match.league),
  };
}

function resolveReferenceCaption(name: string, t: TranslateFn): string {
  return isZhByTranslator(t) ? "参照: " + name : "Reference: " + name;
}

export const fengshuiHomePresenter: DomainHomePresenter = {
  id: "fengshui_home",
  useRemoteFeed: true,
  sectionTitleKey: "fengshui.home.section_title",
  sectionHintKey: "fengshui.home.section_hint",
  refreshActionKey: "fengshui.home.refresh_action",
  openActionKey: "fengshui.home.open_action",
  noDataKey: "fengshui.home.no_data",
  searchPlaceholderKey: "fengshui.home.search_placeholder",
  getEntityDisplay: (match, _ctx, subjectSnapshot) => {
    const snapshot = toRecord(subjectSnapshot);
    const entity = resolveEntity(match, snapshot);
    return {
      kind: "single",
      entity: {
        id: match.homeTeam.id || match.id + "_subject",
        name: entity.primaryName,
        logo: entity.primaryLogo,
      },
      caption: resolveReferenceCaption(entity.secondaryName, _ctx.t),
    };
  },
  getSearchTokens: (match, subjectSnapshot) => {
    const snapshot = toRecord(subjectSnapshot);
    const entity = resolveEntity(match, snapshot);
    return [
      entity.primaryName,
      entity.secondaryName,
      entity.subtitle,
      toString(snapshot?.siteProfile?.propertyType, ""),
      toString(snapshot?.siteProfile?.facingDirection, ""),
    ];
  },
  getStatusLabel: (status, ctx) => resolveStatusLabel(status, ctx.t),
  getStatusClassName: (status) => {
    if (status === "live") return "bg-red-500/20 text-red-500 animate-pulse";
    if (status === "finished") return "bg-zinc-800 text-zinc-400";
    return "bg-emerald-500/20 text-emerald-500";
  },
  getOutcomeLabels: (_match, ctx) => {
    const labels = resolveOutcomeLabels(ctx.t);
    return {
      homeLabel: labels.homeLabel || "Aligned",
      drawLabel: labels.drawLabel || "Balanced",
      awayLabel: labels.awayLabel || "Cautious",
    };
  },
  getCenterDisplay: (match, ctx, subjectSnapshot) => {
    const snapshot = toRecord(subjectSnapshot);
    const qiScore = toNumber(snapshot?.qiFlow?.qiFlowScore) ?? toNumber(match.stats?.possession?.home);
    const pressure = toNumber(snapshot?.qiFlow?.shaPressure) ?? toNumber(match.stats?.shots?.away);
    const timing = toNumber(snapshot?.temporalCycle?.monthlyInfluence);
    const isZh = isZhByTranslator(ctx.t);

    if (qiScore != null || pressure != null || timing != null) {
      return {
        kind: "metrics",
        items: [
          {
            label: isZh ? "气场" : "Qi",
            value: qiScore == null ? "--" : String(Math.round(qiScore)),
            tone:
              qiScore == null
                ? "neutral"
                : qiScore >= 65
                  ? "positive"
                  : qiScore <= 45
                    ? "negative"
                    : "neutral",
          },
          {
            label: isZh ? "煞压" : "Pressure",
            value: pressure == null ? "--" : pressure.toFixed(1),
            tone: pressure == null ? "neutral" : pressure >= 60 ? "negative" : "neutral",
          },
          {
            label: isZh ? "时运" : "Timing",
            value: timing == null ? "--" : timing.toFixed(1),
            tone:
              timing == null ? "neutral" : timing >= 1 ? "positive" : timing <= -1 ? "negative" : "neutral",
          },
        ],
      };
    }

    if (match.status === "upcoming" || match.status === "live") {
      return { kind: "text", value: isZh ? "观察中" : "Tracking" };
    }

    return { kind: "text", value: isZh ? "快照" : "Snapshot" };
  },
};

export const fengshuiHistoryPresenter: DomainHistoryPresenter = {
  id: "fengshui_history",
  getOutcomeDistribution: (analysis, _match, ctx) =>
    getAnalysisOutcomeDistribution(analysis, resolveOutcomeLabels(ctx.t)),
};

export const fengshuiResultPresenter: DomainResultPresenter = {
  id: "fengshui_result",
  getLoadingContextText: (ctx) =>
    isZhByTranslator(ctx.t) ? "正在加载分析上下文..." : "Loading analysis context...",
  getNotFoundText: (ctx) => (isZhByTranslator(ctx.t) ? "未找到分析对象" : "Analysis target not found"),
  getHeader: (match, draftData, ctx) => {
    const entity = resolveEntity(match, draftData);
    return {
      subtitle: entity.subtitle + " | " + resolveReferenceCaption(entity.secondaryName, ctx.t),
      title: entity.primaryName,
    };
  },
  getSummaryHero: (match, draftData, ctx) => {
    const entity = resolveEntity(match, draftData);
    return {
      kind: "single",
      entity: {
        id: match.homeTeam.id || "subject",
        name: entity.primaryName,
        logo: entity.primaryLogo,
      },
      caption: resolveReferenceCaption(entity.secondaryName, ctx.t),
    };
  },
  getSummaryDistribution: (analysis, _match, _draftData, ctx) =>
    getAnalysisOutcomeDistribution(analysis, resolveOutcomeLabels(ctx.t)),
  getExportMeta: (match, draftData, ctx) => {
    const entity = resolveEntity(match, draftData);
    const reportTitle = isZhByTranslator(ctx.t)
      ? `${entity.primaryName}（参照：${entity.secondaryName}）`
      : `${entity.primaryName} (Reference: ${entity.secondaryName})`;

    return {
      reportTitle,
      primaryEntityName: entity.primaryName,
      secondaryEntityName: entity.secondaryName,
      statusLabel: resolveStatusLabel(match.status, ctx.t),
    };
  },
};

export const FENGSHUI_DOMAIN_UI_PRESENTER: DomainUiPresenter = {
  id: "fengshui",
  home: fengshuiHomePresenter,
  history: fengshuiHistoryPresenter,
  result: fengshuiResultPresenter,
};

export const DOMAIN_UI_PRESENTER_ENTRIES: DomainUiPresenter[] = [FENGSHUI_DOMAIN_UI_PRESENTER];
