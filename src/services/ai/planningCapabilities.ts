import { getAgent, hasAgent } from "../../agents";
import type {
  PlanningAgentCapability,
  PlanningAnimationCapability,
  PlanningSourceCapability,
} from "../../agents/types";
import { getAnalysisDomainById } from "../domains/registry";
import type { AnalysisDomain } from "../domains/types";
import type { HubEndpointHint } from "../extensions/types";
import { getTemplateDeclaration } from "../remotion/templateParams";
import type {
  AnalysisRequestPayload,
  NormalizedPlanSegment,
} from "./contracts";

const RESERVED_UTILITY_AGENT_IDS = new Set(["tag", "summary", "animation"]);

function isPlannerAgentId(agentId: string): boolean {
  if (agentId === "planner_template" || agentId === "planner_autonomous") return true;
  return agentId.includes("_planner_");
}

function normalizeSourceIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return Array.from(new Set(normalized));
}

function normalizeDomainId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveDomainExpertAgentIds(domain: AnalysisDomain | null): string[] {
  const ids = normalizeSourceIdList(domain?.resources?.agents || []);
  return ids.filter(
    (agentId) => !RESERVED_UTILITY_AGENT_IDS.has(agentId) && !isPlannerAgentId(agentId),
  );
}

function resolveAnimationTypeNote(animationType: string): string {
  switch (animationType) {
    case "stats":
      return "Use for numeric metrics and score-style comparisons.";
    case "comparison":
      return "Use for side-by-side contrast between key entities.";
    case "tactical":
      return "Use for structure, flow, or spatial relationship explanation.";
    case "odds":
      return "Use for probability, pricing, and scenario weighting.";
    case "none":
      return "Use when narrative text is sufficient and no visualization is needed.";
    default:
      return "Use when this visual style clarifies the segment output.";
  }
}

function resolveSelectedSourceMap(sourceContext: any): Record<string, boolean> {
  const selectedByFlag =
    sourceContext?.selectedSources && typeof sourceContext.selectedSources === "object"
      ? sourceContext.selectedSources
      : {};
  const selectedByIds = normalizeSourceIdList(sourceContext?.selectedSourceIds);

  const merged: Record<string, boolean> = {};
  Object.entries(selectedByFlag).forEach(([key, value]) => {
    if (typeof key !== "string" || key.trim().length === 0) return;
    merged[key.trim()] = value === true;
  });
  selectedByIds.forEach((id) => {
    merged[id] = true;
  });
  return merged;
}

function cloneJsonLike<T>(input: T): T {
  try {
    return JSON.parse(JSON.stringify(input));
  } catch {
    return input;
  }
}

export function resolvePlanningHubHint(
  matchData: AnalysisRequestPayload,
  routeHub?: HubEndpointHint,
): HubEndpointHint | undefined {
  const rawSourceHub = matchData?.sourceContext?.planning?.hub;
  const sourceHub =
    rawSourceHub && typeof rawSourceHub === "object"
      ? (rawSourceHub as Record<string, unknown>)
      : undefined;
  if (!routeHub && !sourceHub) {
    return undefined;
  }

  return {
    baseUrl:
      routeHub?.baseUrl ||
      (typeof sourceHub?.baseUrl === "string" ? sourceHub.baseUrl : undefined),
    apiKey:
      routeHub?.apiKey ||
      (typeof sourceHub?.apiKey === "string" ? sourceHub.apiKey : undefined),
    autoInstall:
      typeof routeHub?.autoInstall === "boolean"
        ? routeHub.autoInstall
        : typeof sourceHub?.autoInstall === "boolean"
          ? sourceHub.autoInstall
          : undefined,
  };
}

export function resolvePlannerDomainId(
  matchData: AnalysisRequestPayload,
  activeDomainId?: string,
): string | null {
  const fromSourceContext = normalizeDomainId(matchData?.sourceContext?.domainId);
  if (fromSourceContext) return fromSourceContext;
  return normalizeDomainId(activeDomainId);
}

export function buildPlanningAgentCatalog(
  allowedAgentTypes: string[] | null | undefined,
  domain: AnalysisDomain | null,
  requiredAgentIds?: string[],
): PlanningAgentCapability[] {
  const fromRoute = normalizeSourceIdList(allowedAgentTypes || []);
  const fromRequired = normalizeSourceIdList(requiredAgentIds || []).filter(
    (agentId) => !RESERVED_UTILITY_AGENT_IDS.has(agentId) && !isPlannerAgentId(agentId),
  );
  const fromDomain = resolveDomainExpertAgentIds(domain);
  const candidateAgentIds = Array.from(new Set([...fromRoute, ...fromRequired, ...fromDomain]));

  return candidateAgentIds.map((agentId) => {
    if (!hasAgent(agentId)) {
      return { id: agentId };
    }
    const agent = getAgent(agentId);
    return {
      id: agentId,
      name: typeof agent.name === "string" ? agent.name : undefined,
      description: typeof agent.description === "string" ? agent.description : undefined,
      contextDependencies: agent.contextDependencies,
    };
  });
}

export function resolveEffectiveAllowedAgentTypes(
  routeAllowedAgentTypes: string[] | null | undefined,
  planningAgentCatalog: PlanningAgentCapability[],
): string[] | null {
  const fromRoute = normalizeSourceIdList(routeAllowedAgentTypes || []);
  if (fromRoute.length > 0) return fromRoute;

  const fromCatalog = normalizeSourceIdList(
    planningAgentCatalog.map((entry) => (typeof entry?.id === "string" ? entry.id : "")),
  );
  return fromCatalog.length > 0 ? fromCatalog : null;
}

export function buildPlanningAnimationCatalog(
  allowedAnimationTypes: string[] | null | undefined,
  domainId: string | null,
  includeAnimations: boolean,
): PlanningAnimationCapability[] {
  const fromRoute = normalizeSourceIdList(allowedAnimationTypes || []);
  const candidateTypes = includeAnimations
    ? Array.from(new Set([...fromRoute, "none"]))
    : ["none"];

  return candidateTypes.map((type) => {
    if (type === "none") {
      return {
        type,
        note: resolveAnimationTypeNote(type),
      };
    }
    const declaration = getTemplateDeclaration(type, { domainId: domainId || undefined });
    return {
      type,
      templateId: declaration.templateId,
      note: resolveAnimationTypeNote(type),
    };
  });
}

export function resolveEffectiveAllowedAnimationTypes(
  routeAllowedAnimationTypes: string[] | null | undefined,
  planningAnimationCatalog: PlanningAnimationCapability[],
  includeAnimations: boolean,
): string[] | null {
  if (!includeAnimations) return ["none"];

  const fromRoute = normalizeSourceIdList(routeAllowedAnimationTypes || []);
  if (fromRoute.length > 0) {
    return Array.from(new Set([...fromRoute, "none"]));
  }

  const fromCatalog = normalizeSourceIdList(
    planningAnimationCatalog.map((entry) =>
      typeof entry?.type === "string" ? entry.type : "",
    ),
  );
  if (fromCatalog.length > 0) {
    return Array.from(new Set([...fromCatalog, "none"]));
  }

  return ["none"];
}

export function buildPlanningSourceCatalog(
  domain: AnalysisDomain | null,
  allowedSourceIds: string[] | undefined,
  matchData: AnalysisRequestPayload,
): PlanningSourceCapability[] {
  if (!domain || !Array.isArray(domain.dataSources) || domain.dataSources.length === 0) {
    return [];
  }

  const selectedMap = resolveSelectedSourceMap(matchData?.sourceContext);
  const sourceById = new Map(
    domain.dataSources.map((source) => [
      typeof source.id === "string" ? source.id.trim() : "",
      source,
    ]),
  );
  sourceById.delete("");

  const fromRoute = normalizeSourceIdList(allowedSourceIds || []);
  const candidateSourceIds =
    fromRoute.length > 0 ? fromRoute : Array.from(sourceById.keys());
  const routeSet = new Set(fromRoute);

  return candidateSourceIds.map((sourceId) => {
    const source = sourceById.get(sourceId);
    const hasSelectedFlag = Object.prototype.hasOwnProperty.call(selectedMap, sourceId);
    const selected = hasSelectedFlag
      ? selectedMap[sourceId] === true
      : routeSet.size > 0
        ? routeSet.has(sourceId)
        : undefined;

    return {
      id: sourceId,
      labelKey: source?.labelKey,
      descriptionKey: source?.descriptionKey,
      selected,
    };
  });
}

export function resolveEffectiveAllowedSourceIds(
  routeAllowedSourceIds: string[] | undefined,
  planningSourceCatalog: PlanningSourceCapability[],
): string[] {
  const fromRoute = normalizeSourceIdList(routeAllowedSourceIds || []);
  if (fromRoute.length > 0) return fromRoute;

  const fromCatalog = normalizeSourceIdList(
    planningSourceCatalog
      .filter((source) => source.selected !== false)
      .map((source) => source.id),
  );
  return fromCatalog;
}

export function buildSegmentScopedMatchData(
  matchData: AnalysisRequestPayload,
  segmentPlan: NormalizedPlanSegment,
): AnalysisRequestPayload {
  if (!matchData || typeof matchData !== "object") return matchData;

  const sourceContext =
    matchData.sourceContext && typeof matchData.sourceContext === "object"
      ? matchData.sourceContext
      : null;
  if (!sourceContext) return matchData;

  const requestedSourceIds = normalizeSourceIdList(segmentPlan?.sourceIds);
  if (requestedSourceIds.length === 0) return matchData;

  const domainId =
    typeof sourceContext.domainId === "string" && sourceContext.domainId.trim().length > 0
      ? sourceContext.domainId.trim()
      : null;
  const domain = getAnalysisDomainById(domainId);
  if (!domain || !Array.isArray(domain.dataSources) || domain.dataSources.length === 0) {
    return matchData;
  }

  const selectedMap = resolveSelectedSourceMap(sourceContext);
  const availableSourceIds = new Set(
    domain.dataSources
      .map((source) => (typeof source?.id === "string" ? source.id.trim() : ""))
      .filter((id) => id.length > 0),
  );
  const effectiveSourceIds = requestedSourceIds.filter(
    (id) => availableSourceIds.has(id) && selectedMap[id] === true,
  );

  if (effectiveSourceIds.length === 0) {
    return matchData;
  }

  const scopedData = cloneJsonLike(matchData);
  const scopedSelection: Record<string, boolean> = {};
  const effectiveSet = new Set(effectiveSourceIds);

  for (const source of domain.dataSources) {
    const sourceId = typeof source?.id === "string" ? source.id.trim() : "";
    if (!sourceId) continue;
    const shouldKeep = effectiveSet.has(sourceId);
    scopedSelection[sourceId] = shouldKeep;
    if (!shouldKeep) {
      try {
        source.removeFromData(scopedData);
      } catch (error) {
        console.warn("Failed to remove source payload from scoped segment data", {
          sourceId,
          error,
        });
      }
    }
  }

  const scopedCapabilities =
    typeof domain.buildSourceCapabilities === "function"
      ? domain.buildSourceCapabilities(scopedData, scopedSelection)
      : sourceContext.capabilities || {};

  scopedData.sourceContext = {
    ...sourceContext,
    selectedSources: scopedSelection,
    selectedSourceIds: effectiveSourceIds,
    capabilities: scopedCapabilities,
    segmentSourceIds: effectiveSourceIds,
  };

  return scopedData;
}
