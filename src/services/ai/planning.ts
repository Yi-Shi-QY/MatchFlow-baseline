import type { HubEndpointHint } from "../extensions/types";
import type { AppSettings } from "../settings";

export type TemplateType = "basic" | "standard" | "odds_focused" | "comprehensive";

export interface PlanningRouteDecision {
  mode: "template" | "autonomous";
  templateType?: string;
  allowedAgentTypes: string[] | null;
  reason: string;
  requiredAgentIds?: string[];
  requiredSkillIds?: string[];
  hub?: HubEndpointHint;
}

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

function parsePlanningRequirements(planningContext: any) {
  const requiredAgentIds = Array.isArray(planningContext?.requiredAgents)
    ? planningContext.requiredAgents.filter((id: any) => typeof id === "string")
    : [];
  const requiredSkillIds = Array.isArray(planningContext?.requiredSkills)
    ? planningContext.requiredSkills.filter((id: any) => typeof id === "string")
    : [];
  const hub: HubEndpointHint | undefined =
    planningContext?.hub && typeof planningContext.hub === "object"
      ? {
          baseUrl:
            typeof planningContext.hub.baseUrl === "string"
              ? planningContext.hub.baseUrl
              : undefined,
          apiKey:
            typeof planningContext.hub.apiKey === "string"
              ? planningContext.hub.apiKey
              : undefined,
          autoInstall:
            typeof planningContext.hub.autoInstall === "boolean"
              ? planningContext.hub.autoInstall
              : undefined,
        }
      : undefined;

  return { requiredAgentIds, requiredSkillIds, hub };
}

export function resolvePlanningRoute(
  matchData: any,
  settings: Pick<AppSettings, "enableAutonomousPlanning">,
): PlanningRouteDecision {
  const planningContext = matchData?.sourceContext?.planning || {};
  const requirements = parsePlanningRequirements(planningContext);

  if (settings.enableAutonomousPlanning) {
    return {
      mode: "autonomous",
      allowedAgentTypes: null,
      reason: "settings.enableAutonomousPlanning=true",
      ...requirements,
    };
  }

  const forcedMode = planningContext?.mode;
  if (forcedMode === "autonomous") {
    return {
      mode: "autonomous",
      allowedAgentTypes: null,
      reason: "sourceContext.planning.mode=autonomous",
      ...requirements,
    };
  }

  const forcedTemplateId =
    typeof planningContext?.templateId === "string" && planningContext.templateId.trim().length > 0
      ? planningContext.templateId.trim()
      : typeof planningContext?.templateType === "string" &&
          planningContext.templateType.trim().length > 0
        ? planningContext.templateType.trim()
        : null;

  if (forcedTemplateId) {
    return {
      mode: "template",
      templateType: forcedTemplateId,
      allowedAgentTypes: null,
      reason: `sourceContext.planning.template=${forcedTemplateId}`,
      ...requirements,
    };
  }

  const signals = deriveSourceSignals(matchData);

  if (signals.wantsCustom && !signals.wantsFundamental && !signals.wantsMarket) {
    return {
      mode: "autonomous",
      allowedAgentTypes: null,
      reason: "custom-only input",
      ...requirements,
    };
  }

  if (signals.wantsMarket && !signals.wantsFundamental) {
    return {
      mode: "template",
      templateType: "odds_focused",
      allowedAgentTypes: ["overview", "odds", "prediction", "general"],
      reason: "market-only input",
      ...requirements,
    };
  }

  if (signals.hasOdds && signals.hasStats) {
    return {
      mode: "template",
      templateType: "comprehensive",
      allowedAgentTypes: null,
      reason: signals.status === "live" ? "live match with stats+odds" : "stats+odds",
      ...requirements,
    };
  }

  if (signals.hasOdds && !signals.hasStats) {
    return {
      mode: "template",
      templateType: "odds_focused",
      allowedAgentTypes: ["overview", "odds", "prediction", "general"],
      reason: "odds without stats",
      ...requirements,
    };
  }

  if (signals.hasStats) {
    return {
      mode: "template",
      templateType: "standard",
      allowedAgentTypes: null,
      reason: signals.status === "live" ? "live match with stats" : "stats only",
      ...requirements,
    };
  }

  return {
    mode: "template",
    templateType: "basic",
    allowedAgentTypes: ["overview", "prediction", "general"],
    reason: "minimal data",
    ...requirements,
  };
}

export function buildFallbackPlan(language: "en" | "zh") {
  if (language === "zh") {
    return [
      {
        title: "比赛概览",
        focus: "整体背景与关键线索",
        animationType: "none",
        agentType: "overview",
        contextMode: "independent",
      },
      {
        title: "赛前预测",
        focus: "最终预测与结论",
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

export function normalizePlan(
  rawPlan: any[],
  includeAnimations: boolean,
  allowedAgentTypes: string[] | null,
  language: "en" | "zh",
) {
  let plan = Array.isArray(rawPlan) ? [...rawPlan] : [];

  if (allowedAgentTypes && allowedAgentTypes.length > 0) {
    plan = plan.filter((segment) => {
      const agentType = segment?.agentType || "general";
      return allowedAgentTypes.includes(agentType);
    });
  }

  if (plan.length === 0) {
    plan = buildFallbackPlan(language);
  }

  const hasPrediction = plan.some(
    (segment) => (segment?.agentType || "general") === "prediction",
  );
  if (!hasPrediction) {
    if (language === "zh") {
      plan.push({
        title: "赛前预测",
        focus: "最终预测与结论",
        animationType: "none",
        agentType: "prediction",
        contextMode: "all",
      });
    } else {
      plan.push({
        title: "Match Prediction",
        focus: "Final prediction and conclusion",
        animationType: "none",
        agentType: "prediction",
        contextMode: "all",
      });
    }
  }

  return plan.map((segment) => ({
    ...segment,
    agentType: segment?.agentType || "general",
    animationType: includeAnimations ? segment?.animationType || "none" : "none",
    contextMode: segment?.contextMode || "build_upon",
  }));
}

