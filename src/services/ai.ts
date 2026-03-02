import { getSettings } from "./settings";
import { executeSkill } from "../skills";
import { getAgent } from "../agents";
import { buildFallbackPlan, normalizePlan, resolvePlanningRoute } from "./ai/planning";
import { streamAIRequest } from "./ai/streamRequest";
import { generateValidatedAnimationBlock } from "./ai/animationPipeline";
import {
  ensureAgentAvailable,
  ensurePlanAgentRequirements,
  ensureSkillAvailable,
  ensureTemplateRequirements,
} from "./extensions/runtime";
import { HubEndpointHint } from "./extensions/types";
export { testConnection } from "./ai/connection";
export { getGeminiAI } from "./ai/geminiClient";
export { streamAnimationAgent, streamFixAnimationParams } from "./ai/animationPipeline";

export interface MatchAnalysis {
  prediction: string;
  keyFactors: string[];
  winProbability: {
    home: number;
    draw: number;
    away: number;
  };
  expectedGoals: {
    home: number;
    away: number;
  };
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

export function isAbortError(error: any): boolean {
  return error?.name === "AbortError";
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
          route.allowedAgentTypes,
          language,
        );
        await ensurePlanAgentRequirements(normalized, hubHint);
        return normalized;
      }
    }

    // Fallback path: ask planner agent to generate plan.
    const agentId = route.mode === "autonomous" ? "planner_autonomous" : "planner_template";
    const agent = getAgent(agentId);

    const prompt = agent.systemPrompt({
      matchData,
      language,
      includeAnimations,
    });

    let responseText = "";
    const stopAfterToolCall = agentId === "planner_template";
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
              route.allowedAgentTypes,
              language,
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
    const normalized = normalizePlan(parsed, includeAnimations, route.allowedAgentTypes, language);
    await ensurePlanAgentRequirements(normalized, hubHint);
    return normalized;
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error("Failed to parse plan JSON", e, "route:", route.reason);
    const normalized = normalizePlan(
      buildFallbackPlan(language),
      includeAnimations,
      route.allowedAgentTypes,
      language,
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
}

export async function* streamAgentThoughts(
  matchData: any, 
  includeAnimations: boolean = true,
  resumeState?: AnalysisResumeState,
  onStateUpdate?: (state: AnalysisResumeState) => void,
  abortSignal?: AbortSignal,
) {
  throwIfAborted(abortSignal);
  const hubHint = resolvePlanningHubHint(matchData);
  // 1. Planning Phase (Hidden)
  let plan = resumeState?.plan || [];
  let completedSegmentIndices = resumeState?.completedSegmentIndices || [];
  let fullAnalysisText = resumeState?.fullAnalysisText || "";
  let segmentResults: SegmentResult[] = resumeState?.segmentResults || [];

  if (!resumeState) {
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
      segment.animationType = 'none';
    }

    const agentId = segment.agentType || 'general';
    await ensureAgentAvailable(agentId, hubHint);
    const agent = getAgent(agentId);
    
    let filteredContext = "";
    const deps = agent.contextDependencies || 'all';
    if (deps === 'none') {
      filteredContext = "";
    } else if (deps === 'all') {
      filteredContext = segmentResults.map(r => `[From ${r.agentId} - ${r.title}]:\n${r.content}`).join('\n\n');
    } else if (Array.isArray(deps)) {
      const relevantResults = segmentResults.filter(r => deps.includes(r.agentId));
      if (relevantResults.length > 0) {
        filteredContext = relevantResults.map(r => `[From ${r.agentId} - ${r.title}]:\n${r.content}`).join('\n\n');
      }
    }

    // A. Run Analysis Agent
    let segmentText = "";
    const segmentStream = streamAnalysisAgent(matchData, segment, filteredContext, abortSignal);
    for await (const chunk of segmentStream) {
      throwIfAborted(abortSignal);
      segmentText += chunk;
      fullAnalysisText += chunk;
      yield chunk;
    }

    // A.1 Run Animation Agent (if needed)
    if (includeAnimations && segment.animationType && segment.animationType !== 'none') {
      // Parameter-first flow:
      // 1) LLM extracts template params JSON
      // 2) System validates and retries if invalid
      // 3) System emits normalized <animation> block
      const animationOutput = await generateValidatedAnimationBlock(
        matchData,
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
    const cleanText = segmentText.replace(/<[^>]+>/g, ' ').trim();
    const tagStream = streamTagAgent(cleanText, abortSignal);
    for await (const chunk of tagStream) {
      throwIfAborted(abortSignal);
      segmentText += chunk;
      yield chunk;
    }

    yield "\n";
    segmentText += "\n";
    fullAnalysisText += "\n";
    
    segmentResults.push({ agentId, title: segment.title, content: segmentText });
    completedSegmentIndices.push(i);
    onStateUpdate?.({ plan, completedSegmentIndices, fullAnalysisText, segmentResults });
  }

  // 3. Summary Phase
  throwIfAborted(abortSignal);
  const summaryStream = streamSummaryAgent(matchData, fullAnalysisText, abortSignal);
  for await (const chunk of summaryStream) {
    throwIfAborted(abortSignal);
    yield chunk;
  }
}








