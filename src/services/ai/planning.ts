import type { HubEndpointHint } from "../extensions/types";
import type { AppSettings } from "../settings";
import { DEFAULT_DOMAIN_ID } from "../domains/builtinModules";
import {
  getPlanningStrategyByDomainId,
  getPlanningStrategyForAnalysis,
} from "../domains/planning/registry";
import type { DomainPlanningStrategy } from "../domains/planning/types";
import type { PlanningRouteDecision } from "../domains/planning/types";

export type TemplateType = string;
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
  const plannerAgentId =
    typeof planningContext?.plannerAgentId === "string" &&
    planningContext.plannerAgentId.trim().length > 0
      ? planningContext.plannerAgentId.trim()
      : undefined;

  return { requiredAgentIds, requiredSkillIds, hub, plannerAgentId };
}

function resolveDomainSettings(
  settings?: Pick<AppSettings, "activeDomainId">,
): Pick<AppSettings, "activeDomainId"> {
  return {
    activeDomainId:
      typeof settings?.activeDomainId === "string" && settings.activeDomainId.trim().length > 0
        ? settings.activeDomainId
        : DEFAULT_DOMAIN_ID,
  };
}

function normalizePlannerAgentId(agentId: unknown): string | null {
  if (typeof agentId !== "string") return null;
  const normalized = agentId.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolvePlannerAgentIdForMode(
  requestedPlannerAgentId: string | undefined,
  strategy: DomainPlanningStrategy,
  mode: "template" | "autonomous",
): string {
  const requested = normalizePlannerAgentId(requestedPlannerAgentId);
  if (requested) return requested;

  const strategyPlanner = normalizePlannerAgentId(strategy.getPlannerAgentId?.(mode));
  if (strategyPlanner) return strategyPlanner;

  const defaultStrategy = getPlanningStrategyByDomainId(DEFAULT_DOMAIN_ID);
  const defaultPlanner = normalizePlannerAgentId(defaultStrategy?.getPlannerAgentId?.(mode));
  if (defaultPlanner) {
    console.warn(
      `[planning] Missing planner agent for domain "${strategy.domainId}" mode "${mode}". ` +
        `Fallback to default domain planner "${defaultPlanner}".`,
    );
    return defaultPlanner;
  }

  const legacyFallback = mode === "autonomous" ? "planner_autonomous" : "planner_template";
  console.warn(
    `[planning] No planner agent found for domain "${strategy.domainId}" mode "${mode}". ` +
      `Fallback to legacy planner "${legacyFallback}".`,
  );
  return legacyFallback;
}

export function resolvePlanningRoute(
  matchData: any,
  settings: Pick<AppSettings, "enableAutonomousPlanning" | "activeDomainId">,
): PlanningRouteDecision {
  const planningContext = matchData?.sourceContext?.planning || {};
  const {
    requiredAgentIds,
    requiredSkillIds,
    hub,
    plannerAgentId: requestedPlannerAgentId,
  } = parsePlanningRequirements(planningContext);
  const strategy = getPlanningStrategyForAnalysis(
    matchData,
    resolveDomainSettings({ activeDomainId: settings.activeDomainId }),
  );
  const resolvePlannerAgentId = (mode: "template" | "autonomous") =>
    resolvePlannerAgentIdForMode(requestedPlannerAgentId, strategy, mode);

  if (settings.enableAutonomousPlanning) {
    return {
      mode: "autonomous",
      plannerAgentId: resolvePlannerAgentId("autonomous"),
      allowedAgentTypes: null,
      reason: "settings.enableAutonomousPlanning=true",
      requiredAgentIds,
      requiredSkillIds,
      hub,
    };
  }

  const forcedMode = planningContext?.mode;
  if (forcedMode === "autonomous") {
    return {
      mode: "autonomous",
      plannerAgentId: resolvePlannerAgentId("autonomous"),
      allowedAgentTypes: null,
      reason: "sourceContext.planning.mode=autonomous",
      requiredAgentIds,
      requiredSkillIds,
      hub,
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
      plannerAgentId: resolvePlannerAgentId("template"),
      templateType: forcedTemplateId,
      allowedAgentTypes: null,
      reason: `sourceContext.planning.template=${forcedTemplateId}`,
      requiredAgentIds,
      requiredSkillIds,
      hub,
    };
  }
  const domainRoute = strategy.resolveRoute(matchData);
  return {
    ...domainRoute,
    plannerAgentId: domainRoute.plannerAgentId || resolvePlannerAgentId(domainRoute.mode),
    requiredAgentIds,
    requiredSkillIds,
    hub,
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
