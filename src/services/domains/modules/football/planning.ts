import type { DomainPlanningStrategy } from "../../planning/types";

export type TemplateType = "basic" | "standard" | "odds_focused" | "comprehensive";

function hasNonEmptyObject(value: any): boolean {
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
}

function deriveSourceSignals(matchData: any) {
  const selected = matchData?.sourceContext?.selectedSources;
  const selectedIds = Array.isArray(matchData?.sourceContext?.selectedSourceIds)
    ? new Set(
        matchData.sourceContext.selectedSourceIds.filter(
          (id: any) => typeof id === "string",
        ),
      )
    : null;
  const sourceCapabilities = matchData?.sourceContext?.capabilities || {};

  const wantsFundamental =
    typeof selected?.fundamental === "boolean"
      ? !!selected.fundamental
      : selectedIds?.has("fundamental") ?? sourceCapabilities.hasFundamental ?? true;

  const wantsMarket =
    typeof selected?.market === "boolean"
      ? !!selected.market
      : selectedIds?.has("market") ?? hasNonEmptyObject(matchData?.odds);

  const wantsCustom =
    typeof selected?.custom === "boolean"
      ? !!selected.custom
      : selectedIds?.has("custom") ??
        (typeof matchData?.customInfo === "string"
          ? matchData.customInfo.trim().length > 0
          : matchData?.customInfo != null);

  const hasStats =
    typeof sourceCapabilities.hasStats === "boolean"
      ? sourceCapabilities.hasStats
      : hasNonEmptyObject(matchData?.stats);
  const hasOdds =
    typeof sourceCapabilities.hasOdds === "boolean"
      ? sourceCapabilities.hasOdds
      : hasNonEmptyObject(matchData?.odds);
  const status =
    typeof matchData?.status === "string" ? matchData.status.toLowerCase() : "unknown";

  return {
    wantsFundamental,
    wantsMarket,
    wantsCustom,
    hasStats,
    hasOdds,
    status,
  };
}

function buildFootballFallbackPlan(language: "en" | "zh") {
  if (language === "zh") {
    return [
      {
        title: "Analysis Overview",
        focus: "General context",
        animationType: "none",
        agentType: "overview",
        contextMode: "independent",
      },
      {
        title: "Final Prediction",
        focus: "Final prediction and conclusion",
        animationType: "none",
        agentType: "prediction",
        contextMode: "all",
      },
    ];
  }

  return [
    {
      title: "Match Overview",
      focus: "General context",
      animationType: "none",
      agentType: "overview",
      contextMode: "independent",
    },
    {
      title: "Match Prediction",
      focus: "Main talking points",
      animationType: "none",
      agentType: "prediction",
      contextMode: "all",
    },
  ];
}

function buildFootballTerminalSegment(language: "en" | "zh") {
  if (language === "zh") {
    return {
      title: "Final Prediction",
      focus: "Final prediction and conclusion",
      animationType: "none",
      agentType: "prediction",
      contextMode: "all",
    };
  }

  return {
    title: "Match Prediction",
    focus: "Final prediction and conclusion",
    animationType: "none",
    agentType: "prediction",
    contextMode: "all",
  };
}

export const footballPlanningStrategy: DomainPlanningStrategy = {
  domainId: "football",
  resolveRoute: (matchData: any) => {
    const signals = deriveSourceSignals(matchData);

    if (signals.wantsCustom && !signals.wantsFundamental && !signals.wantsMarket) {
      return {
        mode: "autonomous",
        allowedAgentTypes: null,
        reason: "custom-only input",
      };
    }

    if (signals.wantsMarket && !signals.wantsFundamental) {
      return {
        mode: "template",
        templateType: "odds_focused",
        allowedAgentTypes: ["overview", "odds", "prediction", "general"],
        reason: "market-only input",
      };
    }

    if (signals.hasOdds && signals.hasStats) {
      return {
        mode: "template",
        templateType: "comprehensive",
        allowedAgentTypes: null,
        reason: signals.status === "live" ? "live match with stats+odds" : "stats+odds",
      };
    }

    if (signals.hasOdds && !signals.hasStats) {
      return {
        mode: "template",
        templateType: "odds_focused",
        allowedAgentTypes: ["overview", "odds", "prediction", "general"],
        reason: "odds without stats",
      };
    }

    if (signals.hasStats) {
      return {
        mode: "template",
        templateType: "standard",
        allowedAgentTypes: null,
        reason: signals.status === "live" ? "live match with stats" : "stats only",
      };
    }

    return {
      mode: "template",
      templateType: "basic",
      allowedAgentTypes: ["overview", "prediction", "general"],
      reason: "minimal data",
    };
  },
  buildFallbackPlan: buildFootballFallbackPlan,
  requiredTerminalAgentType: "prediction",
  buildRequiredTerminalSegment: buildFootballTerminalSegment,
};
