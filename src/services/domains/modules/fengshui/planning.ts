import type { DomainPlanningStrategy } from "../../planning/types";

export type TemplateType =
  | "fengshui_basic"
  | "fengshui_standard"
  | "fengshui_focused"
  | "fengshui_comprehensive";

function hasNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pickSignal(
  analysisData: any,
  capabilityKey: string,
  sourceKey: string,
  fallback: boolean,
): boolean {
  const capabilities = analysisData?.sourceContext?.capabilities || {};
  if (typeof capabilities?.[capabilityKey] === "boolean") {
    return capabilities[capabilityKey];
  }

  const selectedSources = analysisData?.sourceContext?.selectedSources || {};
  if (typeof selectedSources?.[sourceKey] === "boolean") {
    return selectedSources[sourceKey];
  }

  const selectedSourceIds = Array.isArray(analysisData?.sourceContext?.selectedSourceIds)
    ? new Set(
        analysisData.sourceContext.selectedSourceIds.filter(
          (item: unknown) => typeof item === "string",
        ),
      )
    : null;

  if (selectedSourceIds) {
    return selectedSourceIds.has(sourceKey);
  }

  return fallback;
}

function deriveSourceSignals(analysisData: any) {
  const hasSiteProfile = pickSignal(
    analysisData,
    "hasSiteProfile",
    "site_profile",
    hasNonEmptyObject(analysisData?.siteProfile),
  );
  const hasQiFlow = pickSignal(
    analysisData,
    "hasQiFlow",
    "qi_flow",
    hasNonEmptyObject(analysisData?.qiFlow),
  );
  const hasTemporalCycle = pickSignal(
    analysisData,
    "hasTemporalCycle",
    "temporal_cycle",
    hasNonEmptyObject(analysisData?.temporalCycle),
  );
  const hasOccupantIntent = pickSignal(
    analysisData,
    "hasOccupantIntent",
    "occupant_intent",
    hasNonEmptyObject(analysisData?.occupantIntent) || hasNonEmptyString(analysisData?.customInfo),
  );

  return {
    hasSiteProfile,
    hasQiFlow,
    hasTemporalCycle,
    hasOccupantIntent,
  };
}

function buildFallbackPlan(language: "en" | "zh") {
  if (language === "zh") {
    return [
      {
        title: "场域概览",
        focus: "主体背景、朝向与用途约束",
        animationType: "none",
        agentType: "fengshui_overview",
        contextMode: "independent",
        sourceIds: ["site_profile"],
      },
      {
        title: "最终结论",
        focus: "综合气场、时运与目标给出执行建议",
        animationType: "none",
        agentType: "fengshui_prediction",
        contextMode: "all",
        sourceIds: ["site_profile", "qi_flow", "temporal_cycle", "occupant_intent"],
      },
    ];
  }
  return [
    {
      title: "Site Overview",
      focus: "Subject setup, orientation, and use constraints",
      animationType: "none",
      agentType: "fengshui_overview",
      contextMode: "independent",
      sourceIds: ["site_profile"],
    },
    {
      title: "Final Recommendation",
      focus: "Synthesize qi, timing, and intent into actionable guidance",
      animationType: "none",
      agentType: "fengshui_prediction",
      contextMode: "all",
      sourceIds: ["site_profile", "qi_flow", "temporal_cycle", "occupant_intent"],
    },
  ];
}

export const fengshuiPlanningStrategy: DomainPlanningStrategy = {
  domainId: "fengshui",
  getPlannerAgentId: (mode) =>
    mode === "autonomous" ? "fengshui_planner_autonomous" : "fengshui_planner_template",
  resolveRoute: (analysisData: any) => {
    const signals = deriveSourceSignals(analysisData);

    if (
      signals.hasOccupantIntent &&
      !signals.hasSiteProfile &&
      !signals.hasQiFlow &&
      !signals.hasTemporalCycle
    ) {
      return {
        mode: "autonomous",
        allowedAgentTypes: null,
        reason: "intent-only input",
      };
    }

    if (signals.hasSiteProfile && signals.hasQiFlow && signals.hasTemporalCycle) {
      return {
        mode: "template",
        templateType: "fengshui_comprehensive",
        allowedAgentTypes: null,
        reason: "full fengshui source coverage",
      };
    }

    if (signals.hasTemporalCycle && !signals.hasQiFlow) {
      return {
        mode: "template",
        templateType: "fengshui_focused",
        allowedAgentTypes: ["fengshui_overview", "fengshui_analysis", "fengshui_prediction", "fengshui_general"],
        reason: "timing-dominant source set",
      };
    }

    if (signals.hasQiFlow) {
      return {
        mode: "template",
        templateType: "fengshui_standard",
        allowedAgentTypes: null,
        reason: "qi-structure source set",
      };
    }

    return {
      mode: "template",
      templateType: "fengshui_basic",
      allowedAgentTypes: ["fengshui_overview", "fengshui_prediction", "fengshui_general"],
      reason: "minimal source set",
    };
  },
  buildFallbackPlan,
  requiredTerminalAgentType: "fengshui_prediction",
  buildRequiredTerminalSegment: (language: "en" | "zh") =>
    language === "zh"
      ? {
          title: "最终结论",
          focus: "综合气场、时运与目标给出执行建议",
          animationType: "none",
          agentType: "fengshui_prediction",
          contextMode: "all",
          sourceIds: ["site_profile", "qi_flow", "temporal_cycle", "occupant_intent"],
        }
      : {
          title: "Final Recommendation",
          focus: "Synthesize qi, timing, and intent into actionable guidance",
          animationType: "none",
          agentType: "fengshui_prediction",
          contextMode: "all",
          sourceIds: ["site_profile", "qi_flow", "temporal_cycle", "occupant_intent"],
        },
};
