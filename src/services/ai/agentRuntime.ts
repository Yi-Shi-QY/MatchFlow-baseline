import { getSettings } from "../settings";
import { getAgent } from "../../agents";
import { streamAIRequest } from "./streamRequest";
import { extractJson } from "../../utils/json";
import { resolvePlanningHubHint } from "./planningCapabilities";
import { ensureAgentAvailable } from "../extensions/runtime";
import type {
  AnalysisRequestPayload,
  NormalizedPlanSegment,
} from "./contracts";

type TagTeam = "home" | "away" | "neutral";

interface NormalizedTag {
  label: string;
  team: TagTeam;
  color?: string;
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

export async function generateValidatedTagsBlock(
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

export async function* streamAnalysisAgent(
  matchData: AnalysisRequestPayload,
  segmentPlan: NormalizedPlanSegment,
  previousAnalysis: string = "",
  abortSignal?: AbortSignal,
) {
  throwIfAborted(abortSignal);
  const settings = getSettings();
  const hubHint = resolvePlanningHubHint(matchData);
  const agentId = segmentPlan.agentType || "general";
  await ensureAgentAvailable(agentId, hubHint);
  const agent = getAgent(agentId);
  const prompt = agent.systemPrompt({
    matchData,
    segmentPlan,
    language: settings.language,
    previousAnalysis,
  });

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id, abortSignal);
}

export async function* streamTagAgent(analysisText: string, abortSignal?: AbortSignal) {
  throwIfAborted(abortSignal);
  const settings = getSettings();
  const agent = getAgent("tag");
  const prompt = agent.systemPrompt({ analysisText, language: settings.language });

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id, abortSignal);
}

export async function* streamSummaryAgent(
  matchData: AnalysisRequestPayload,
  previousAnalysis: string,
  abortSignal?: AbortSignal,
) {
  throwIfAborted(abortSignal);
  const settings = getSettings();
  const agent = getAgent("summary");
  const prompt = agent.systemPrompt({
    matchData,
    previousAnalysis,
    language: settings.language,
  });

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id, abortSignal);
}
