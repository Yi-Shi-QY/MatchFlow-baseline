import type { DomainPlanningStrategy } from "../../planning/types";

function hasNonEmptyObject(value: any): boolean {
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
}

function hasNonEmptyArray(value: any): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasCustomInfo(value: any): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

function hasSituationalNotes(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  return hasCustomInfo(value.narrative) || hasNonEmptyArray(value.signals);
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

  const wantsGameContext =
    typeof selected?.game_context === "boolean"
      ? !!selected.game_context
      : typeof selected?.context === "boolean"
        ? !!selected.context
        : typeof selected?.fundamental === "boolean"
          ? !!selected.fundamental
          : selectedIds?.has("game_context") ??
            selectedIds?.has("context") ??
            selectedIds?.has("fundamental") ??
            sourceCapabilities.hasFundamental ??
            true;

  const wantsPerformanceMatrix =
    typeof selected?.performance_matrix === "boolean"
      ? !!selected.performance_matrix
      : selectedIds?.has("performance_matrix") ??
        sourceCapabilities.hasPerformanceMatrix ??
        sourceCapabilities.hasStats ??
        (hasNonEmptyObject(matchData?.basketballMetrics) || hasNonEmptyObject(matchData?.stats));

  const wantsBettingLines =
    typeof selected?.betting_lines === "boolean"
      ? !!selected.betting_lines
      : typeof selected?.market === "boolean"
        ? !!selected.market
        : selectedIds?.has("betting_lines") ??
          selectedIds?.has("market") ??
          sourceCapabilities.hasBettingLines ??
          sourceCapabilities.hasOdds ??
          (hasNonEmptyObject(matchData?.lines) || hasNonEmptyObject(matchData?.odds));

  const wantsSituationalNotes =
    typeof selected?.situational_notes === "boolean"
      ? !!selected.situational_notes
      : typeof selected?.custom_notes === "boolean"
        ? !!selected.custom_notes
        : typeof selected?.custom === "boolean"
          ? !!selected.custom
          : selectedIds?.has("situational_notes") ??
            selectedIds?.has("custom_notes") ??
            selectedIds?.has("custom") ??
            sourceCapabilities.hasSituationalNotes ??
            sourceCapabilities.hasCustom ??
            (hasSituationalNotes(matchData?.situationalNotes) || hasCustomInfo(matchData?.customInfo));

  const hasPerformanceMatrix =
    typeof sourceCapabilities.hasPerformanceMatrix === "boolean"
      ? sourceCapabilities.hasPerformanceMatrix
      : typeof sourceCapabilities.hasStats === "boolean"
        ? sourceCapabilities.hasStats
        : hasNonEmptyObject(matchData?.basketballMetrics) || hasNonEmptyObject(matchData?.stats);

  const hasBettingLines =
    typeof sourceCapabilities.hasBettingLines === "boolean"
      ? sourceCapabilities.hasBettingLines
      : typeof sourceCapabilities.hasOdds === "boolean"
        ? sourceCapabilities.hasOdds
        : hasNonEmptyObject(matchData?.lines) || hasNonEmptyObject(matchData?.odds);

  const status =
    typeof matchData?.gameContext?.tipOffStatus === "string"
      ? matchData.gameContext.tipOffStatus.toLowerCase()
      : typeof matchData?.status === "string"
        ? matchData.status.toLowerCase()
        : "unknown";

  return {
    wantsGameContext,
    wantsPerformanceMatrix,
    wantsBettingLines,
    wantsSituationalNotes,
    hasPerformanceMatrix,
    hasBettingLines,
    status,
  };
}

function buildBasketballFallbackPlan(language: "en" | "zh") {
  if (language === "zh") {
    return [
      {
        title: "比赛概览",
        focus: "球队背景与关键看点",
        animationType: "none",
        agentType: "basketball_overview",
        contextMode: "independent",
      },
      {
        title: "比赛走势预测",
        focus: "最终胜负倾向与风险提示",
        animationType: "none",
        agentType: "basketball_prediction",
        contextMode: "all",
      },
    ];
  }

  return [
    {
      title: "Game Overview",
      focus: "Context and key talking points",
      animationType: "none",
      agentType: "basketball_overview",
      contextMode: "independent",
    },
    {
      title: "Outcome Projection",
      focus: "Final projection and risk notes",
      animationType: "none",
      agentType: "basketball_prediction",
      contextMode: "all",
    },
  ];
}

function buildBasketballTerminalSegment(language: "en" | "zh") {
  if (language === "zh") {
    return {
      title: "最终判断",
      focus: "给出最终胜负判断与关键风险",
      animationType: "none",
      agentType: "basketball_prediction",
      contextMode: "all",
    };
  }

  return {
    title: "Final Projection",
    focus: "Provide final outcome projection with risks",
    animationType: "none",
    agentType: "basketball_prediction",
    contextMode: "all",
  };
}

export const basketballPlanningStrategy: DomainPlanningStrategy = {
  domainId: "basketball",
  resolveRoute: (matchData: any) => {
    const signals = deriveSourceSignals(matchData);

    if (
      signals.wantsSituationalNotes &&
      !signals.wantsGameContext &&
      !signals.wantsPerformanceMatrix &&
      !signals.wantsBettingLines
    ) {
      return {
        mode: "autonomous",
        allowedAgentTypes: null,
        reason: "insights-only input",
      };
    }

    if (
      signals.wantsBettingLines &&
      !signals.wantsGameContext &&
      !signals.wantsPerformanceMatrix
    ) {
      return {
        mode: "template",
        templateType: "basketball_lines_focused",
        allowedAgentTypes: [
          "basketball_overview",
          "basketball_market",
          "basketball_prediction",
          "basketball_general",
        ],
        reason: "lines without context",
      };
    }

    if (signals.hasPerformanceMatrix && signals.hasBettingLines) {
      return {
        mode: "template",
        templateType: "basketball_comprehensive",
        allowedAgentTypes: null,
        reason:
          signals.status === "live"
            ? "live game with metrics+lines"
            : "metrics+lines",
      };
    }

    if (signals.hasPerformanceMatrix) {
      return {
        mode: "template",
        templateType: "basketball_standard",
        allowedAgentTypes: null,
        reason: "metrics-driven analysis",
      };
    }

    if (signals.hasBettingLines) {
      return {
        mode: "template",
        templateType: "basketball_lines_focused",
        allowedAgentTypes: [
          "basketball_overview",
          "basketball_market",
          "basketball_prediction",
          "basketball_general",
        ],
        reason: "lines-driven analysis",
      };
    }

    return {
      mode: "template",
      templateType: "basketball_basic",
      allowedAgentTypes: [
        "basketball_overview",
        "basketball_prediction",
        "basketball_general",
      ],
      reason: "minimal data",
    };
  },
  buildFallbackPlan: buildBasketballFallbackPlan,
  requiredTerminalAgentType: "basketball_prediction",
  buildRequiredTerminalSegment: buildBasketballTerminalSegment,
};

