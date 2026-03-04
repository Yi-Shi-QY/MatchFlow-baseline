import type { HubEndpointHint } from "../extensions/types";
import type { AppSettings } from "../settings";
import { DEFAULT_DOMAIN_ID } from "../domains/builtinModules";
import { getAnalysisDomainById } from "../domains/registry";
import {
  getPlanningStrategyByDomainId,
  getPlanningStrategyForAnalysis,
} from "../domains/planning/registry";
import type { DomainPlanningStrategy } from "../domains/planning/types";
import type { PlanningRouteDecision } from "../domains/planning/types";
import { listAnimationTypesForDomain } from "../remotion/templateParams";

export type TemplateType = string;
export type { PlanningRouteDecision };

const RESERVED_UTILITY_AGENT_IDS = new Set(["tag", "summary", "animation"]);

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

function extractScopedPrefix(value: string): string | null {
  const index = value.indexOf("_");
  if (index <= 0) return null;
  const prefix = value.slice(0, index).trim();
  return prefix.length > 0 ? prefix : null;
}

function isPlannerAgentCompatibleWithDomain(agentId: string, domainId: string): boolean {
  if (agentId === "planner_template" || agentId === "planner_autonomous") {
    return true;
  }

  if (!agentId.includes("_planner_")) {
    return true;
  }

  const prefix = extractScopedPrefix(agentId);
  if (!prefix) return true;
  const strategy = getPlanningStrategyByDomainId(prefix);
  if (!strategy) return true;
  return prefix === domainId;
}

function isTemplateCompatibleWithDomain(templateId: string, domainId: string): boolean {
  const prefix = extractScopedPrefix(templateId);
  if (!prefix) return true;
  const strategy = getPlanningStrategyByDomainId(prefix);
  if (!strategy) return true;
  return prefix === domainId;
}

function isPlannerAgentId(agentId: string): boolean {
  if (agentId === "planner_template" || agentId === "planner_autonomous") return true;
  return agentId.includes("_planner_");
}

function resolveDomainAllowedAgentTypes(domainId: string): string[] {
  const domain = getAnalysisDomainById(domainId);
  if (!domain?.resources?.agents || !Array.isArray(domain.resources.agents)) {
    return [];
  }

  const allowed = domain.resources.agents.filter((agentId) => {
    if (typeof agentId !== "string" || agentId.trim().length === 0) return false;
    if (RESERVED_UTILITY_AGENT_IDS.has(agentId)) return false;
    return !isPlannerAgentId(agentId);
  });

  return Array.from(new Set(allowed));
}

function resolveAllowedAnimationTypes(matchData: any, domainId: string): string[] {
  const planningContext = matchData?.sourceContext?.planning || {};
  const explicit = normalizeSourceIdList(
    planningContext?.allowedAnimationTypes || planningContext?.animationTypes,
  );
  if (explicit.length > 0) {
    return Array.from(new Set([...explicit, "none"]));
  }

  const domain = getAnalysisDomainById(domainId);
  const animationTemplateIds = Array.isArray(domain?.resources?.animations)
    ? domain?.resources?.animations
    : [];

  const derived = listAnimationTypesForDomain({
    domainId,
    animationTemplateIds,
    includeNone: true,
  });
  if (derived.length > 0) return derived;
  return ["none"];
}

function resolvePlannerAgentIdForMode(
  requestedPlannerAgentId: string | undefined,
  strategy: DomainPlanningStrategy,
  mode: "template" | "autonomous",
): string {
  const requested = normalizePlannerAgentId(requestedPlannerAgentId);
  if (requested) {
    if (isPlannerAgentCompatibleWithDomain(requested, strategy.domainId)) {
      return requested;
    }
    console.warn(
      `[planning] Ignore plannerAgentId "${requested}" because it is incompatible with domain "${strategy.domainId}".`,
    );
  }

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
  const domainAllowedAgentTypes = resolveDomainAllowedAgentTypes(strategy.domainId);
  const allowedAnimationTypes = resolveAllowedAnimationTypes(matchData, strategy.domainId);
  const allowedSourceIds = resolveSelectedSourceIds(matchData);
  const resolveAllowedAgentTypes = (candidate: string[] | null | undefined): string[] | null => {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
    return domainAllowedAgentTypes.length > 0 ? domainAllowedAgentTypes : null;
  };
  const resolvePlannerAgentId = (mode: "template" | "autonomous") =>
    resolvePlannerAgentIdForMode(requestedPlannerAgentId, strategy, mode);

  if (settings.enableAutonomousPlanning) {
    return {
      mode: "autonomous",
      plannerAgentId: resolvePlannerAgentId("autonomous"),
      allowedAgentTypes: resolveAllowedAgentTypes(null),
      allowedAnimationTypes,
      allowedSourceIds,
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
      allowedAgentTypes: resolveAllowedAgentTypes(null),
      allowedAnimationTypes,
      allowedSourceIds,
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

  const compatibleForcedTemplateId =
    forcedTemplateId && isTemplateCompatibleWithDomain(forcedTemplateId, strategy.domainId)
      ? forcedTemplateId
      : null;

  if (forcedTemplateId && !compatibleForcedTemplateId) {
    console.warn(
      `[planning] Ignore forced template "${forcedTemplateId}" because it is incompatible with domain "${strategy.domainId}".`,
    );
  }

  if (compatibleForcedTemplateId) {
    return {
      mode: "template",
      plannerAgentId: resolvePlannerAgentId("template"),
      templateType: compatibleForcedTemplateId,
      allowedAgentTypes: resolveAllowedAgentTypes(null),
      allowedAnimationTypes,
      allowedSourceIds,
      reason: `sourceContext.planning.template=${compatibleForcedTemplateId}`,
      requiredAgentIds,
      requiredSkillIds,
      hub,
    };
  }
  const domainRoute = strategy.resolveRoute(matchData);
  return {
    ...domainRoute,
    plannerAgentId: domainRoute.plannerAgentId || resolvePlannerAgentId(domainRoute.mode),
    allowedAgentTypes: resolveAllowedAgentTypes(domainRoute.allowedAgentTypes),
    allowedAnimationTypes,
    allowedSourceIds,
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

function normalizeSourceIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return Array.from(new Set(normalized));
}

function resolveSelectedSourceIds(matchData: any): string[] {
  const sourceContext = matchData?.sourceContext;
  if (!sourceContext || typeof sourceContext !== "object") return [];

  const byIds = normalizeSourceIdList(sourceContext.selectedSourceIds);
  if (byIds.length > 0) return byIds;

  const selectedSources =
    sourceContext.selectedSources && typeof sourceContext.selectedSources === "object"
      ? sourceContext.selectedSources
      : null;
  if (!selectedSources) return [];

  return Object.entries(selectedSources)
    .filter(
      ([key, value]) =>
        typeof key === "string" && key.trim().length > 0 && value === true,
    )
    .map(([key]) => key.trim());
}

function normalizeSegmentSourceIds(segment: any, matchData: any): string[] {
  const fromSourceIds = normalizeSourceIdList(segment?.sourceIds);
  const fromDataSourceIds = normalizeSourceIdList(segment?.dataSourceIds);
  const explicit = fromSourceIds.length > 0 ? fromSourceIds : fromDataSourceIds;
  if (explicit.length > 0) return explicit;

  return resolveSelectedSourceIds(matchData);
}

export function normalizePlan(
  rawPlan: any[],
  includeAnimations: boolean,
  allowedAgentTypes: string[] | null,
  allowedAnimationTypes: string[] | null,
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

  const normalizedAllowedAnimationTypes =
    Array.isArray(allowedAnimationTypes) && allowedAnimationTypes.length > 0
      ? new Set(allowedAnimationTypes)
      : null;

  return plan.map((segment) => ({
    ...segment,
    agentType: segment?.agentType || "general",
    animationType: (() => {
      if (!includeAnimations) return "none";
      const candidate =
        typeof segment?.animationType === "string" && segment.animationType.trim().length > 0
          ? segment.animationType.trim()
          : "none";
      if (!normalizedAllowedAnimationTypes) return candidate;
      return normalizedAllowedAnimationTypes.has(candidate) ? candidate : "none";
    })(),
    contextMode: segment?.contextMode || "build_upon",
    sourceIds: normalizeSegmentSourceIds(segment, matchData),
  }));
}
