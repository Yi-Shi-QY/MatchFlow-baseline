import type { HubEndpointHint } from "../extensions/types";
import type { AppSettings } from "../settings";
import type { TemplateType as FootballTemplateType } from "../domains/planning/football";
import { getPlanningStrategyForAnalysis } from "../domains/planning/registry";
import type { PlanningRouteDecision } from "../domains/planning/types";

export type TemplateType = FootballTemplateType;
export type { PlanningRouteDecision };

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

function resolveDomainSettings(
  settings?: Pick<AppSettings, "activeDomainId">,
): Pick<AppSettings, "activeDomainId"> {
  return {
    activeDomainId:
      typeof settings?.activeDomainId === "string" && settings.activeDomainId.trim().length > 0
        ? settings.activeDomainId
        : "football",
  };
}

export function resolvePlanningRoute(
  matchData: any,
  settings: Pick<AppSettings, "enableAutonomousPlanning" | "activeDomainId">,
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

  const strategy = getPlanningStrategyForAnalysis(
    matchData,
    resolveDomainSettings({ activeDomainId: settings.activeDomainId }),
  );
  const domainRoute = strategy.resolveRoute(matchData);
  return {
    ...domainRoute,
    ...requirements,
  };
}

export function buildFallbackPlan(
  language: "en" | "zh",
  matchData?: any,
  settings?: Pick<AppSettings, "activeDomainId">,
) {
  const strategy = getPlanningStrategyForAnalysis(matchData, resolveDomainSettings(settings));
  return strategy.buildFallbackPlan(language);
}

export function normalizePlan(
  rawPlan: any[],
  includeAnimations: boolean,
  allowedAgentTypes: string[] | null,
  language: "en" | "zh",
  matchData?: any,
  settings?: Pick<AppSettings, "activeDomainId">,
) {
  const strategy = getPlanningStrategyForAnalysis(matchData, resolveDomainSettings(settings));
  let plan = Array.isArray(rawPlan) ? [...rawPlan] : [];

  if (allowedAgentTypes && allowedAgentTypes.length > 0) {
    plan = plan.filter((segment) => {
      const agentType = segment?.agentType || "general";
      return allowedAgentTypes.includes(agentType);
    });
  }

  if (plan.length === 0) {
    plan = strategy.buildFallbackPlan(language);
  }

  const requiredTerminalAgentType = strategy.requiredTerminalAgentType;
  if (requiredTerminalAgentType) {
    const hasTerminalAgent = plan.some(
      (segment) => (segment?.agentType || "general") === requiredTerminalAgentType,
    );
    const canAppendTerminalAgent =
      !allowedAgentTypes || allowedAgentTypes.includes(requiredTerminalAgentType);

    if (!hasTerminalAgent && canAppendTerminalAgent) {
      if (strategy.buildRequiredTerminalSegment) {
        plan.push(strategy.buildRequiredTerminalSegment(language));
      } else {
        plan.push({
          title: "Final Segment",
          focus: "Final output",
          animationType: "none",
          agentType: requiredTerminalAgentType,
          contextMode: "all",
        });
      }
    }
  }

  return plan.map((segment) => ({
    ...segment,
    agentType: segment?.agentType || "general",
    animationType: includeAnimations ? segment?.animationType || "none" : "none",
    contextMode: segment?.contextMode || "build_upon",
  }));
}
