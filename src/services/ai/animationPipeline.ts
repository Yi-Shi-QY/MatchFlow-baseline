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

function resolveDomainId(matchData: any): string | null {
  const fromSourceContext =
    typeof matchData?.sourceContext?.domainId === "string"
      ? matchData.sourceContext.domainId.trim()
      : "";
  if (fromSourceContext) return fromSourceContext;

  const fromConfig =
    typeof matchData?.analysisConfig?.domainId === "string"
      ? matchData.analysisConfig.domainId.trim()
      : "";
  if (fromConfig) return fromConfig;

  return null;
}

function resolveAnimationLabels(matchData: any): { primary: string; secondary: string } {
  const subject =
    matchData?.siteProfile?.subjectName ||
    matchData?.assetProfile?.symbol ||
    matchData?.homeTeam?.name ||
    "Primary";
  const reference =
    matchData?.siteProfile?.referenceFrame ||
    matchData?.assetProfile?.benchmark ||
    matchData?.awayTeam?.name ||
    "Reference";

  return {
    primary: typeof subject === "string" && subject.trim() ? subject.trim() : "Primary",
    secondary: typeof reference === "string" && reference.trim() ? reference.trim() : "Reference",
  };
}

export async function* streamAnimationAgent(
  matchData: any,
  segmentPlan: any,
  analysisText: string,
  abortSignal?: AbortSignal,
) {
  throwIfAborted(abortSignal);
  const domainId = resolveDomainId(matchData);
  const labels = resolveAnimationLabels(matchData);
  const declaration = getTemplateDeclaration(segmentPlan.animationType || "stats", {
    domainId,
  });
  const fallback = buildFallbackAnimationPayload(
    segmentPlan.animationType || "stats",
    segmentPlan.title || "Data Visualization",
    labels.primary,
    labels.secondary,
    { domainId },
  );

  const animationSchema = `
  ${buildTemplatePromptSpec(
    segmentPlan.animationType || "stats",
    segmentPlan.title || "",
    labels.primary,
    labels.secondary,
    { domainId },
  )}

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
  const domainId = resolveDomainId(matchData);
  const labels = resolveAnimationLabels(matchData);
  const declaration = getTemplateDeclaration(segmentPlan.animationType || "stats", {
    domainId,
  });

  const prompt = `
  You are fixing animation template parameters.
  You are NOT writing Remotion component code.
  You must return exactly one <animation> JSON block with valid params.

  TEMPLATE CONTRACT:
  ${buildTemplatePromptSpec(
    segmentPlan.animationType || "stats",
    segmentPlan.title || "",
    labels.primary,
    labels.secondary,
    { domainId },
  )}

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
  const domainId = resolveDomainId(matchData);
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
  const validation = validateAndNormalizeAnimationPayload(rawPayload, expectedType, {
    domainId,
    templateId:
      typeof wrongAnimation?.templateId === "string" ? wrongAnimation.templateId : undefined,
  });

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
  const domainId = resolveDomainId(matchData);
  const labels = resolveAnimationLabels(matchData);
  const expectedType = segmentPlan.animationType || "stats";
  const maxFixAttempts = 2;

  let candidateText = await collectStreamText(
    streamAnimationAgent(matchData, segmentPlan, analysisText, abortSignal),
    abortSignal,
  );

  for (let attempt = 0; attempt <= maxFixAttempts; attempt++) {
    throwIfAborted(abortSignal);
    const rawPayload = extractAnimationPayload(candidateText);
    const validation = validateAndNormalizeAnimationPayload(rawPayload, expectedType, {
      domainId,
    });

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
    labels.primary,
    labels.secondary,
    { domainId },
  );
  fallback.narration = typeof segmentPlan?.focus === "string" ? segmentPlan.focus : "";
  return buildAnimationBlock(fallback);
}
