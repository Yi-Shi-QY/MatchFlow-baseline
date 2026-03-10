import { getSettings } from "./settings";
import { executeSkill } from "../skills";
import { getAgent } from "../agents";
import { buildFallbackPlan, normalizePlan, resolvePlanningRoute } from "./ai/planning";
import { streamAIRequest } from "./ai/streamRequest";
import type {
  StreamRequestTelemetryEvent,
  StreamRequestTelemetryHandler,
} from "./ai/streamRequest";
import { generateValidatedAnimationBlock } from "./ai/animationPipeline";
import type { Match } from "../data/matches";
import { getAnalysisDomainById } from "./domains/registry";
import type {
  AnalysisRequestPayload,
  NormalizedPlanSegment,
} from "./ai/contracts";
import {
  ensureAgentAvailable,
  ensurePlanAgentRequirements,
  ensureSkillAvailable,
  ensureTemplateRequirements,
} from "./extensions/runtime";
import {
  buildPlanningAgentCatalog,
  buildPlanningAnimationCatalog,
  buildPlanningSourceCatalog,
  buildSegmentScopedMatchData,
  resolveEffectiveAllowedAgentTypes,
  resolveEffectiveAllowedAnimationTypes,
  resolveEffectiveAllowedSourceIds,
  resolvePlannerDomainId,
  resolvePlanningHubHint,
} from "./ai/planningCapabilities";
import {
  generateValidatedTagsBlock,
  streamAnalysisAgent,
  streamSummaryAgent,
} from "./ai/agentRuntime";
import { normalizeMultimodalInputForProvider } from "./ai/multimodalCompatibility";
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
export {
  streamAnalysisAgent,
  streamTagAgent,
  streamSummaryAgent,
} from "./ai/agentRuntime";

export type AnalysisRunTelemetryEvent = StreamRequestTelemetryEvent;
export type AnalysisRunTelemetryHandler = StreamRequestTelemetryHandler;

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

function createAbortError() {
  const err = new Error("Analysis aborted") as Error & { name: string };
  err.name = "AbortError";
  return err;
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Analysis failed";
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError"
  );
}

export async function generateAnalysisPlan(
  matchData: AnalysisRequestPayload,
  includeAnimations: boolean = true,
  abortSignal?: AbortSignal,
  onRequestTelemetry?: StreamRequestTelemetryHandler,
): Promise<NormalizedPlanSegment[]> {
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
      onRequestTelemetry,
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

export interface SegmentResult {
  agentId: string;
  title: string;
  content: string;
}

export interface AnalysisResumeState {
  plan: NormalizedPlanSegment[];
  completedSegmentIndices: number[];
  fullAnalysisText: string;
  segmentResults?: SegmentResult[];
  runtimeStatus?: PlannerRuntimeState;
  subjectSnapshot?: unknown;
  matchSnapshot?: Match;
}

export async function* streamAgentThoughts(
  matchData: AnalysisRequestPayload,
  includeAnimations: boolean = true,
  resumeState?: AnalysisResumeState,
  onStateUpdate?: (state: AnalysisResumeState) => void,
  abortSignal?: AbortSignal,
  onRuntimeUpdate?: (state: PlannerRuntimeState) => void,
  runtimeRunId?: string,
  onRequestTelemetry?: StreamRequestTelemetryHandler,
) {
  const runId = runtimeRunId || createPlannerRunId("analysis");
  const settings = getSettings();
  const multimodalNormalization = normalizeMultimodalInputForProvider(matchData, {
    provider: settings.provider,
    model: settings.model,
    logger: (message, meta) => {
      console.info(`[multimodal] ${message}`, meta || {});
    },
  });
  const effectiveMatchData = multimodalNormalization.payload;
  const hubHint = resolvePlanningHubHint(effectiveMatchData);
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
        plan = await generateAnalysisPlan(
          effectiveMatchData,
          includeAnimations,
          abortSignal,
          onRequestTelemetry,
        );
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
      const scopedMatchData = buildSegmentScopedMatchData(effectiveMatchData, segment);

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
        onRequestTelemetry,
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
          onRequestTelemetry,
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
      const validatedTags = await generateValidatedTagsBlock(
        cleanText,
        abortSignal,
        onRequestTelemetry,
      );
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
    const summaryStream = streamSummaryAgent(
      effectiveMatchData,
      fullAnalysisText,
      abortSignal,
      onRequestTelemetry,
    );
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
  } catch (error: unknown) {
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
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }
}








