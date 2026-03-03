import { getAgent } from "../../agents";
import { extractJson } from "../../utils/json";
import { getSettings } from "../settings";
import {
  buildAnimationBlock,
  buildFallbackAnimationPayload,
  buildTemplatePromptSpec,
  getTemplateDeclaration,
  type ValidationResult,
  validateAndNormalizeAnimationPayload,
} from "../remotion/templateParams";
import { streamAIRequest } from "./streamRequest";

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const err = new Error("Analysis aborted");
  (err as any).name = "AbortError";
  throw err;
}

async function collectStreamText(
  stream: AsyncGenerator<string>,
  abortSignal?: AbortSignal,
): Promise<string> {
  let output = "";
  throwIfAborted(abortSignal);
  for await (const chunk of stream) {
    throwIfAborted(abortSignal);
    output += chunk;
  }
  throwIfAborted(abortSignal);
  return output;
}

function extractAnimationPayload(outputText: string): any {
  const blockMatch = outputText.match(/<animation>([\s\S]*?)(?:<\/animation>|$)/);
  const raw = (blockMatch?.[1] ?? outputText).trim();
  return extractJson(raw);
}

export async function* streamAnimationAgent(
  matchData: any,
  segmentPlan: any,
  analysisText: string,
  abortSignal?: AbortSignal,
) {
  throwIfAborted(abortSignal);
  const homeName = matchData?.homeTeam?.name || "Home Team";
  const awayName = matchData?.awayTeam?.name || "Away Team";
  const declaration = getTemplateDeclaration(segmentPlan.animationType || "stats");
  const fallback = buildFallbackAnimationPayload(
    segmentPlan.animationType || "stats",
    segmentPlan.title || "Data Visualization",
    homeName,
    awayName,
  );

  const animationSchema = `
  ${buildTemplatePromptSpec(segmentPlan.animationType || "stats", segmentPlan.title || "", homeName, awayName)}

  OUTPUT CONTRACT (STRICT):
  <animation>
  {
    "type": "${segmentPlan.animationType || "stats"}",
    "templateId": "${declaration.templateId}",
    "title": "${segmentPlan.title || "Data Visualization"}",
    "narration": "A short voiceover script in the same language as the analysis.",
    "params": ${JSON.stringify(fallback.params, null, 2)},
    "data": ${JSON.stringify(fallback.params, null, 2)}
  }
  </animation>

  IMPORTANT:
  - "params" MUST contain only template parameters.
  - "data" MUST be exactly the same object as "params" (for backward compatibility).
  - Do NOT output any explanation outside the <animation> block.
  `;

  const settings = getSettings();
  const agent = getAgent("animation");
  const prompt = agent.systemPrompt({
    matchData,
    segmentPlan,
    analysisText,
    animationSchema,
    language: settings.language,
  });

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id, abortSignal);
}

export async function* streamFixAnimationParams(
  matchData: any,
  segmentPlan: any,
  analysisText: string,
  wrongOutput: string,
  errors: string[],
  abortSignal?: AbortSignal,
) {
  throwIfAborted(abortSignal);
  const homeName = matchData?.homeTeam?.name || "Home Team";
  const awayName = matchData?.awayTeam?.name || "Away Team";
  const declaration = getTemplateDeclaration(segmentPlan.animationType || "stats");

  const prompt = `
  You are fixing animation template parameters.
  You are NOT writing Remotion component code.
  You must return exactly one <animation> JSON block with valid params.

  TEMPLATE CONTRACT:
  ${buildTemplatePromptSpec(segmentPlan.animationType || "stats", segmentPlan.title || "", homeName, awayName)}

  EXPECTED TEMPLATE ID: ${declaration.templateId}

  CONTEXT:
  MATCH DATA:
  ${JSON.stringify(matchData)}

  EXPERT ANALYSIS:
  ${analysisText}

  INVALID OUTPUT:
  ${wrongOutput}

  VALIDATION ERRORS:
  ${errors.join("\n")}

  STRICT OUTPUT:
  <animation>
  {
    "type": "${segmentPlan.animationType || "stats"}",
    "templateId": "${declaration.templateId}",
    "title": "${segmentPlan.title || "Data Visualization"}",
    "narration": "Short voiceover",
    "params": { ... },
    "data": { ...same as params... }
  }
  </animation>
  `;

  yield* streamAIRequest(prompt, false, undefined, false, "animation", abortSignal);
}

export async function retryAnimationPayloadWithModel(
  matchData: any,
  segmentPlan: any,
  analysisText: string,
  wrongAnimation: any,
  validationErrors: string[],
  abortSignal?: AbortSignal,
): Promise<ValidationResult> {
  throwIfAborted(abortSignal);
  const expectedType = segmentPlan?.animationType || wrongAnimation?.type || "stats";
  const wrongOutput =
    typeof wrongAnimation === "string"
      ? wrongAnimation
      : JSON.stringify(wrongAnimation || {}, null, 2);

  const candidateText = await collectStreamText(
    streamFixAnimationParams(
      matchData,
      {
        animationType: expectedType,
        title: segmentPlan?.title || wrongAnimation?.title || "Data Visualization",
      },
      analysisText || "",
      wrongOutput,
      Array.isArray(validationErrors) ? validationErrors : [],
      abortSignal,
    ),
    abortSignal,
  );

  const rawPayload = extractAnimationPayload(candidateText);
  const validation = validateAndNormalizeAnimationPayload(rawPayload, expectedType);

  if (!validation.payload.title) {
    validation.payload.title =
      segmentPlan?.title || wrongAnimation?.title || "Data Visualization";
  }
  if (
    !validation.payload.narration &&
    typeof rawPayload?.narration === "string" &&
    rawPayload.narration.trim().length > 0
  ) {
    validation.payload.narration = rawPayload.narration.trim();
  }

  return validation;
}

export async function generateValidatedAnimationBlock(
  matchData: any,
  segmentPlan: any,
  analysisText: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  throwIfAborted(abortSignal);
  const homeName = matchData?.homeTeam?.name || "Home Team";
  const awayName = matchData?.awayTeam?.name || "Away Team";
  const expectedType = segmentPlan.animationType || "stats";
  const maxFixAttempts = 2;

  let candidateText = await collectStreamText(
    streamAnimationAgent(matchData, segmentPlan, analysisText, abortSignal),
    abortSignal,
  );

  for (let attempt = 0; attempt <= maxFixAttempts; attempt++) {
    throwIfAborted(abortSignal);
    const rawPayload = extractAnimationPayload(candidateText);
    const validation = validateAndNormalizeAnimationPayload(rawPayload, expectedType);

    if (!validation.payload.title) {
      validation.payload.title = segmentPlan.title || "Data Visualization";
    }
    if (!validation.payload.narration && typeof rawPayload?.narration === "string") {
      validation.payload.narration = rawPayload.narration;
    }

    if (validation.isValid) {
      return buildAnimationBlock(validation.payload);
    }

    if (attempt < maxFixAttempts) {
      candidateText = await collectStreamText(
        streamFixAnimationParams(
          matchData,
          segmentPlan,
          analysisText,
          candidateText,
          validation.errors,
          abortSignal,
        ),
        abortSignal,
      );
    }
  }

  const fallback = buildFallbackAnimationPayload(
    expectedType,
    segmentPlan.title || "Data Visualization",
    homeName,
    awayName,
  );
  fallback.narration = typeof segmentPlan?.focus === "string" ? segmentPlan.focus : "";
  return buildAnimationBlock(fallback);
}
