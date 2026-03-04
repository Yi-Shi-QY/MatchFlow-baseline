import { getSettings } from "./settings";
import { executeSkill } from "../skills";
import { getAgent, hasAgent } from "../agents";
import type {
  PlanningAgentCapability,
  PlanningAnimationCapability,
  PlanningSourceCapability,
} from "../agents/types";
import { buildFallbackPlan, normalizePlan, resolvePlanningRoute } from "./ai/planning";
import { streamAIRequest } from "./ai/streamRequest";
import { generateValidatedAnimationBlock } from "./ai/animationPipeline";
import { extractJson } from "../utils/json";
import type { Match } from "../data/matches";
import { getAnalysisDomainById } from "./domains/registry";
import type { AnalysisDomain } from "./domains/types";
import {
  ensureAgentAvailable,
  ensurePlanAgentRequirements,
  ensureSkillAvailable,
  ensureTemplateRequirements,
} from "./extensions/runtime";
import { HubEndpointHint } from "./extensions/types";
import { getTemplateDeclaration } from "./remotion/templateParams";
import {
  buildPlannerRuntimeState,
  createPlannerRunId,
  type PlannerRuntimeState,
} from "./planner/runtime";
export { testConnection } from "./ai/connection";
export { getGeminiAI } from "./ai/geminiClient";
export {
  streamAnimationAgent,
  streamFixAnimationParams,
} from "./ai/animationPipeline";

export interface OutcomeDistributionEntry {
  label: string;
  value: number; // Percent-like score; UI will normalize if sum is not 100.
  color?: string;
}

export interface ConclusionCardEntry {
  label: string;
  value: string | number;
  unit?: string;
  confidence?: number; // 0-100
  trend?: "up" | "down" | "neutral";
  note?: string;
}

export interface MatchAnalysis {
  prediction: string;
  keyFactors?: string[];
  // Generic summary payload for non-versus domains (macro, operations, etc.)
  outcomeDistribution?: OutcomeDistributionEntry[];
  conclusionCards?: ConclusionCardEntry[];
  // Backward-compatible fields for versus-match domains.
  winProbability?: {
    home: number;
    draw: number;
    away: number;
  };
  expectedGoals?: {
    home: number;
    away: number;
  };
}

type TagTeam = "home" | "away" | "neutral";

interface NormalizedTag {
  label: string;
  team: TagTeam;
  color?: string;
}

const RESERVED_UTILITY_AGENT_IDS = new Set(["tag", "summary", "animation"]);

function isPlannerAgentId(agentId: string): boolean {
  if (agentId === "planner_template" || agentId === "planner_autonomous") return true;
  return agentId.includes("_planner_");
}

function resolvePlanningHubHint(
  matchData: any,
  routeHub?: HubEndpointHint,
): HubEndpointHint | undefined {
  const sourceHub = matchData?.sourceContext?.planning?.hub;
  if (!routeHub && (!sourceHub || typeof sourceHub !== "object")) {
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

function createAbortError() {
  const err = new Error("Analysis aborted");
  (err as any).name = "AbortError";
  return err;
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  throw createAbortError();
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

function resolvePlannerDomainId(matchData: any, activeDomainId?: string): string | null {
  const fromSourceContext = normalizeDomainId(matchData?.sourceContext?.domainId);
  if (fromSourceContext) return fromSourceContext;
  return normalizeDomainId(activeDomainId);
}

function resolveDomainExpertAgentIds(domain: AnalysisDomain | null): string[] {
  const ids = normalizeSourceIdList(domain?.resources?.agents || []);
  return ids.filter(
    (agentId) => !RESERVED_UTILITY_AGENT_IDS.has(agentId) && !isPlannerAgentId(agentId),
  );
}

function buildPlanningAgentCatalog(
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

function resolveEffectiveAllowedAgentTypes(
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

function buildPlanningAnimationCatalog(
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

function resolveEffectiveAllowedAnimationTypes(
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

function buildPlanningSourceCatalog(
  domain: AnalysisDomain | null,
  allowedSourceIds: string[] | undefined,
  matchData: any,
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

function resolveEffectiveAllowedSourceIds(
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

function buildSegmentScopedMatchData(matchData: any, segmentPlan: any): any {
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

export function isAbortError(error: any): boolean {
  return error?.name === "AbortError";
}

async function collectStreamText(
  stream: AsyncGenerator<string>,
  abortSignal?: AbortSignal,
): Promise<string> {
  throwIfAborted(abortSignal);
  let output = "";
  for await (const chunk of stream) {
    throwIfAborted(abortSignal);
    output += chunk;
  }
  throwIfAborted(abortSignal);
  return output;
}

function normalizeTagArray(input: any): NormalizedTag[] {
  if (!Array.isArray(input)) return [];

  const normalized: NormalizedTag[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const rawLabel = typeof item.label === "string" ? item.label.trim() : "";
    if (!rawLabel) continue;

    const rawTeam = typeof item.team === "string" ? item.team.toLowerCase() : "neutral";
    const team: TagTeam =
      rawTeam === "home" || rawTeam === "away" || rawTeam === "neutral"
        ? (rawTeam as TagTeam)
        : "neutral";

    const tag: NormalizedTag = { label: rawLabel, team };
    if (typeof item.color === "string" && item.color.trim().length > 0) {
      tag.color = item.color.trim();
    }
    normalized.push(tag);
    if (normalized.length >= 5) break;
  }

  return normalized;
}

function extractTagsFromModelOutput(raw: string): NormalizedTag[] {
  if (!raw || !raw.trim()) return [];

  const tagsBlock = raw.match(/<tags>([\s\S]*?)(?:<\/tags>|$)/i);
  if (tagsBlock && tagsBlock[0].includes("</tags>")) {
    const parsed = extractJson(tagsBlock[1].trim());
    const normalized = normalizeTagArray(parsed);
    if (normalized.length > 0) return normalized;
  }

  const directParsed = extractJson(raw);
  return normalizeTagArray(directParsed);
}

function buildFallbackTags(language: "zh" | "en"): NormalizedTag[] {
  if (language === "zh") {
    return [
      { label: "关键观察", team: "neutral", color: "zinc" },
      { label: "核心趋势", team: "neutral", color: "zinc" },
    ];
  }

  return [
    { label: "Key Insight", team: "neutral", color: "zinc" },
    { label: "Core Trend", team: "neutral", color: "zinc" },
  ];
}

function buildTagsBlock(tags: NormalizedTag[]): string {
  return `<tags>\n${JSON.stringify(tags, null, 2)}\n</tags>`;
}

async function generateValidatedTagsBlock(
  analysisText: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  const settings = getSettings();
  const language = settings.language === "zh" ? "zh" : "en";
  const maxAttempts = 2;

  const retryInstruction =
    language === "zh"
      ? "严格要求：仅输出一个完整闭合的 <tags> 区块，内部必须是合法 JSON 数组，不要输出任何解释文本。"
      : "STRICT: Output only one complete <tags> block with a valid JSON array. Do not output explanations.";

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    throwIfAborted(abortSignal);
    const promptText = attempt === 0 ? analysisText : `${analysisText}\n\n${retryInstruction}`;
    const raw = await collectStreamText(streamTagAgent(promptText, abortSignal), abortSignal);
    const normalized = extractTagsFromModelOutput(raw);
    if (normalized.length > 0) {
      return buildTagsBlock(normalized);
    }
  }

  return buildTagsBlock(buildFallbackTags(language));
}

export async function generateAnalysisPlan(
  matchData: any,
  includeAnimations: boolean = true,
  abortSignal?: AbortSignal,
): Promise<any[]> {
  const settings = getSettings();
  const route = resolvePlanningRoute(matchData, settings);
  const language = settings.language === "zh" ? "zh" : "en";
  const hubHint = resolvePlanningHubHint(matchData, route.hub);
  const plannerDomainId = resolvePlannerDomainId(matchData, settings.activeDomainId);
  const plannerDomain = getAnalysisDomainById(plannerDomainId);
  const planningAgentCatalog = buildPlanningAgentCatalog(
    route.allowedAgentTypes,
    plannerDomain,
    route.requiredAgentIds,
  );
  const effectiveAllowedAgentTypes = resolveEffectiveAllowedAgentTypes(
    route.allowedAgentTypes,
    planningAgentCatalog,
  );
  const planningAnimationCatalog = buildPlanningAnimationCatalog(
    route.allowedAnimationTypes,
    plannerDomainId,
    includeAnimations,
  );
  const effectiveAllowedAnimationTypes = resolveEffectiveAllowedAnimationTypes(
    route.allowedAnimationTypes,
    planningAnimationCatalog,
    includeAnimations,
  );
  const planningSourceCatalog = buildPlanningSourceCatalog(
    plannerDomain,
    route.allowedSourceIds,
    matchData,
  );
  const effectiveAllowedSourceIds = resolveEffectiveAllowedSourceIds(
    route.allowedSourceIds,
    planningSourceCatalog,
  );

  try {
    throwIfAborted(abortSignal);
    if (Array.isArray(route.requiredAgentIds) && route.requiredAgentIds.length > 0) {
      for (const agentId of route.requiredAgentIds) {
        throwIfAborted(abortSignal);
        await ensureAgentAvailable(agentId, hubHint);
      }
    }

    if (Array.isArray(route.requiredSkillIds) && route.requiredSkillIds.length > 0) {
      for (const skillId of route.requiredSkillIds) {
        throwIfAborted(abortSignal);
        await ensureSkillAvailable(skillId, hubHint);
      }
    }

    // Deterministic path: route source/capabilities directly to a fixed template.
    if (route.mode === "template" && route.templateType) {
      await ensureTemplateRequirements(route.templateType, hubHint);

      const directResult = await executeSkill("select_plan_template", {
        templateType: route.templateType,
        language,
        includeAnimations,
      });
      if (Array.isArray(directResult)) {
        const normalized = normalizePlan(
          directResult,
          includeAnimations,
          effectiveAllowedAgentTypes,
          effectiveAllowedAnimationTypes,
          language,
          matchData,
          settings,
        );
        await ensurePlanAgentRequirements(normalized, hubHint);
        return normalized;
      }
    }

    // Fallback path: ask planner agent to generate plan.
    const agentId = route.plannerAgentId;
    if (!agentId) {
      throw new Error(
        `Planning route missing plannerAgentId (mode=${route.mode}, reason=${route.reason})`,
      );
    }
    const agent = getAgent(agentId);

    const prompt = agent.systemPrompt({
      matchData,
      language,
      includeAnimations,
      planningMode: route.mode,
      planningReason: route.reason,
      allowedAgentTypes: effectiveAllowedAgentTypes,
      allowedAnimationTypes: effectiveAllowedAnimationTypes,
      allowedSourceIds: effectiveAllowedSourceIds,
      requiredAgentIds: route.requiredAgentIds,
      domainId: plannerDomainId || undefined,
      planningAgentCatalog,
      planningAnimationCatalog,
      planningSourceCatalog,
    });

    let responseText = "";
    const stopAfterToolCall = route.mode === "template";
    const stream = streamAIRequest(
      prompt,
      false,
      agent.skills,
      stopAfterToolCall,
      agent.id,
      abortSignal,
    );

    for await (const chunk of stream) {
      throwIfAborted(abortSignal);
      responseText += chunk;
    }

    if (stopAfterToolCall) {
      const toolResultMatch = responseText.match(/\[SYSTEM\] Tool result: (.*)\n?/);
      if (toolResultMatch) {
        try {
          const parsedResult = JSON.parse(toolResultMatch[1].trim());
          if (Array.isArray(parsedResult)) {
            const normalized = normalizePlan(
              parsedResult,
              includeAnimations,
              effectiveAllowedAgentTypes,
              effectiveAllowedAnimationTypes,
              language,
              matchData,
              settings,
            );
            await ensurePlanAgentRequirements(normalized, hubHint);
            return normalized;
          }
        } catch (e) {
          console.error("Failed to parse tool result", e);
        }
      }
    }

    const cleanText = responseText
      .replace(/\[SYSTEM\].*?\n/g, "")
      .replace(/\[SYSTEM_NOTICE\].*?\n/g, "")
      .replace(/\[ERROR\].*?\n/g, "")
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const jsonMatch = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleanText);
    const normalized = normalizePlan(
      parsed,
      includeAnimations,
      effectiveAllowedAgentTypes,
      effectiveAllowedAnimationTypes,
      language,
      matchData,
      settings,
    );
    await ensurePlanAgentRequirements(normalized, hubHint);
    return normalized;
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error("Failed to parse plan JSON", e, "route:", route.reason);
    const normalized = normalizePlan(
      buildFallbackPlan(language, matchData, settings),
      includeAnimations,
      effectiveAllowedAgentTypes,
      effectiveAllowedAnimationTypes,
      language,
      matchData,
      settings,
    );
    await ensurePlanAgentRequirements(normalized, hubHint);
    return normalized;
  }
}

export async function* streamAnalysisAgent(
  matchData: any,
  segmentPlan: any,
  previousAnalysis: string = "",
  abortSignal?: AbortSignal,
) {
  throwIfAborted(abortSignal);
  const settings = getSettings();
  const hubHint = resolvePlanningHubHint(matchData);
  const agentId = segmentPlan.agentType || 'general';
  await ensureAgentAvailable(agentId, hubHint);
  const agent = getAgent(agentId);
  // No animation schema passed here anymore
  const prompt = agent.systemPrompt({ matchData, segmentPlan, language: settings.language, previousAnalysis });

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id, abortSignal);
}

export async function* streamTagAgent(analysisText: string, abortSignal?: AbortSignal) {
  throwIfAborted(abortSignal);
  const settings = getSettings();
  const agent = getAgent('tag');
  const prompt = agent.systemPrompt({ analysisText, language: settings.language });

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id, abortSignal);
}

export async function* streamSummaryAgent(
  matchData: any,
  previousAnalysis: string,
  abortSignal?: AbortSignal,
) {
  throwIfAborted(abortSignal);
  const settings = getSettings();
  const agent = getAgent('summary');
  const prompt = agent.systemPrompt({ matchData, previousAnalysis, language: settings.language });

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id, abortSignal);
}

export interface SegmentResult {
  agentId: string;
  title: string;
  content: string;
}

export interface AnalysisResumeState {
  plan: any[];
  completedSegmentIndices: number[];
  fullAnalysisText: string;
  segmentResults?: SegmentResult[];
  runtimeStatus?: PlannerRuntimeState;
  subjectSnapshot?: unknown;
  matchSnapshot?: Match;
}

export async function* streamAgentThoughts(
  matchData: any, 
  includeAnimations: boolean = true,
  resumeState?: AnalysisResumeState,
  onStateUpdate?: (state: AnalysisResumeState) => void,
  abortSignal?: AbortSignal,
  onRuntimeUpdate?: (state: PlannerRuntimeState) => void,
  runtimeRunId?: string,
) {
  const runId = runtimeRunId || createPlannerRunId("analysis");
  const hubHint = resolvePlanningHubHint(matchData);
  // 1. Planning Phase (Hidden)
  let plan = resumeState?.plan || [];
  let completedSegmentIndices = resumeState?.completedSegmentIndices || [];
  let fullAnalysisText = resumeState?.fullAnalysisText || "";
  let segmentResults: SegmentResult[] = resumeState?.segmentResults || [];
  let runtimeEventSeq =
    typeof resumeState?.runtimeStatus?.eventSeq === "number"
      ? Math.max(0, Math.floor(resumeState.runtimeStatus.eventSeq))
      : 0;
  let currentRuntimeStage: PlannerRuntimeState["stage"] | null =
    resumeState?.runtimeStatus?.stage || null;
  let currentStageStartedAt =
    typeof resumeState?.runtimeStatus?.stageStartedAt === "number"
      ? Math.max(0, Math.floor(resumeState.runtimeStatus.stageStartedAt))
      : Date.now();

  const emitRuntime = (input: {
    stage: PlannerRuntimeState["stage"];
    segmentIndex?: number;
    totalSegments?: number;
    stageLabel?: string;
    activeAgentId?: string;
    activeSegmentTitle?: string;
    progressPercent?: number;
    errorMessage?: string;
  }) => {
    if (!onRuntimeUpdate) return;
    const timestamp = Date.now();
    if (currentRuntimeStage !== input.stage) {
      currentRuntimeStage = input.stage;
      currentStageStartedAt = timestamp;
    }
    runtimeEventSeq += 1;
    onRuntimeUpdate(
      buildPlannerRuntimeState({
        runId,
        source: "pipeline",
        timestamp,
        eventSeq: runtimeEventSeq,
        stageStartedAt: currentStageStartedAt,
        stageDurationMs: Math.max(0, timestamp - currentStageStartedAt),
        stage: input.stage,
        segmentIndex: input.segmentIndex ?? completedSegmentIndices.length,
        totalSegments: input.totalSegments ?? plan.length,
        stageLabel: input.stageLabel,
        activeAgentId: input.activeAgentId,
        activeSegmentTitle: input.activeSegmentTitle,
        progressPercent: input.progressPercent,
        errorMessage: input.errorMessage,
      }),
    );
  };

  try {
    throwIfAborted(abortSignal);
    if (!resumeState) {
      emitRuntime({
        stage: "planning",
        stageLabel: "Planning",
      });
      try {
        plan = await generateAnalysisPlan(matchData, includeAnimations, abortSignal);
      } catch (e) {
        if (isAbortError(e)) {
          throw e;
        }
        plan = [{ title: "Analysis", focus: "General analysis", animationType: "none", agentType: "general" }];
      }
      throwIfAborted(abortSignal);
      onStateUpdate?.({ plan, completedSegmentIndices, fullAnalysisText, segmentResults });
    }

    // 2. Analysis Phase (Iterative)
    for (let i = 0; i < plan.length; i++) {
      throwIfAborted(abortSignal);
      if (completedSegmentIndices.includes(i)) {
        continue;
      }

      const segment = plan[i];
      if (!includeAnimations) {
        segment.animationType = "none";
      }
      const scopedMatchData = buildSegmentScopedMatchData(matchData, segment);

      const agentId = segment.agentType || "general";
      emitRuntime({
        stage: "segment_running",
        segmentIndex: completedSegmentIndices.length,
        totalSegments: plan.length,
        activeAgentId: agentId,
        activeSegmentTitle: segment.title,
        stageLabel: segment.title || "Segment",
      });
      await ensureAgentAvailable(agentId, hubHint);
      const agent = getAgent(agentId);
      
      let filteredContext = "";
      const deps = agent.contextDependencies || "all";
      if (deps === "none") {
        filteredContext = "";
      } else if (deps === "all") {
        filteredContext = segmentResults.map(r => `[From ${r.agentId} - ${r.title}]:\n${r.content}`).join("\n\n");
      } else if (Array.isArray(deps)) {
        const relevantResults = segmentResults.filter(r => deps.includes(r.agentId));
        if (relevantResults.length > 0) {
          filteredContext = relevantResults.map(r => `[From ${r.agentId} - ${r.title}]:\n${r.content}`).join("\n\n");
        }
      }

      // A. Run Analysis Agent
      let segmentText = "";
      const segmentStream = streamAnalysisAgent(
        scopedMatchData,
        segment,
        filteredContext,
        abortSignal,
      );
      for await (const chunk of segmentStream) {
        throwIfAborted(abortSignal);
        segmentText += chunk;
        fullAnalysisText += chunk;
        yield chunk;
      }

      // A.1 Run Animation Agent (if needed)
      if (includeAnimations && segment.animationType && segment.animationType !== "none") {
        emitRuntime({
          stage: "animation_generating",
          segmentIndex: completedSegmentIndices.length,
          totalSegments: plan.length,
          activeAgentId: agentId,
          activeSegmentTitle: segment.title,
          stageLabel: segment.title || "Animation",
        });
        // Parameter-first flow:
        // 1) LLM extracts template params JSON
        // 2) System validates and retries if invalid
        // 3) System emits normalized <animation> block
        const animationOutput = await generateValidatedAnimationBlock(
          scopedMatchData,
          segment,
          segmentText,
          abortSignal,
        );
        throwIfAborted(abortSignal);
        yield animationOutput;

        // Append animation output to the text tracking variables
        segmentText += "\n" + animationOutput;
        fullAnalysisText += "\n" + animationOutput;
      }

      // B. Run Tag Generation Agent (After analysis is done for this segment)
      // We need to extract the pure text content from the segment output to feed the tag agent
      // Simple regex to strip tags for the prompt
      emitRuntime({
        stage: "tag_generating",
        segmentIndex: completedSegmentIndices.length,
        totalSegments: plan.length,
        activeAgentId: agentId,
        activeSegmentTitle: segment.title,
        stageLabel: segment.title || "Tag generation",
      });
      const cleanText = segmentText.replace(/<[^>]+>/g, " ").trim();
      const validatedTags = await generateValidatedTagsBlock(cleanText, abortSignal);
      throwIfAborted(abortSignal);
      segmentText += validatedTags;
      yield validatedTags;

      yield "\n";
      segmentText += "\n";
      fullAnalysisText += "\n";
      
      segmentResults.push({ agentId, title: segment.title, content: segmentText });
      completedSegmentIndices.push(i);
      onStateUpdate?.({ plan, completedSegmentIndices, fullAnalysisText, segmentResults });
    }

    // 3. Summary Phase
    throwIfAborted(abortSignal);
    emitRuntime({
      stage: "summary_generating",
      segmentIndex: completedSegmentIndices.length,
      totalSegments: plan.length,
      stageLabel: "Summary",
    });
    const summaryStream = streamSummaryAgent(matchData, fullAnalysisText, abortSignal);
    for await (const chunk of summaryStream) {
      throwIfAborted(abortSignal);
      yield chunk;
    }

    emitRuntime({
      stage: "finalizing",
      segmentIndex: completedSegmentIndices.length,
      totalSegments: plan.length,
      stageLabel: "Finalizing",
    });
    emitRuntime({
      stage: "completed",
      segmentIndex: plan.length,
      totalSegments: plan.length,
      progressPercent: 100,
      stageLabel: "Completed",
    });
  } catch (error: any) {
    if (isAbortError(error)) {
      emitRuntime({
        stage: "cancelled",
        segmentIndex: completedSegmentIndices.length,
        totalSegments: plan.length,
        stageLabel: "Cancelled",
      });
      throw error;
    }

    emitRuntime({
      stage: "failed",
      segmentIndex: completedSegmentIndices.length,
      totalSegments: plan.length,
      stageLabel: "Failed",
      errorMessage: error?.message || "Analysis failed",
    });
    throw error;
  }
}








