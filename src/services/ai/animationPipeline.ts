import { getAgent } from "../../agents";
import { extractJson } from "../../utils/json";
import { getSettings } from "../settings";
import {
  buildAnimationBlock,
  buildFallbackAnimationPayload,
  buildTemplatePromptSpec,
  getTemplateDeclaration,
  validateAndNormalizeAnimationPayload,
} from "../remotion/templateParams";
import { streamAIRequest } from "./streamRequest";

async function collectStreamText(stream: AsyncGenerator<string>): Promise<string> {
  let output = "";
  for await (const chunk of stream) {
    output += chunk;
  }
  return output;
}

function extractAnimationPayload(outputText: string): any {
  const blockMatch = outputText.match(/<animation>([\s\S]*?)(?:<\/animation>|$)/);
  const raw = (blockMatch?.[1] ?? outputText).trim();
  return extractJson(raw);
}

export async function* streamAnimationAgent(matchData: any, segmentPlan: any, analysisText: string) {
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

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id);
}

export async function* streamFixAnimationParams(
  matchData: any,
  segmentPlan: any,
  analysisText: string,
  wrongOutput: string,
  errors: string[],
) {
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

  yield* streamAIRequest(prompt, false, undefined, false, "animation");
}

export async function generateValidatedAnimationBlock(
  matchData: any,
  segmentPlan: any,
  analysisText: string,
): Promise<string> {
  const homeName = matchData?.homeTeam?.name || "Home Team";
  const awayName = matchData?.awayTeam?.name || "Away Team";
  const expectedType = segmentPlan.animationType || "stats";
  const maxFixAttempts = 2;

  let candidateText = await collectStreamText(streamAnimationAgent(matchData, segmentPlan, analysisText));

  for (let attempt = 0; attempt <= maxFixAttempts; attempt++) {
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
        ),
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
