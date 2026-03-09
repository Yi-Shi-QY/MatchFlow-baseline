import type {
  AnalysisOutputBlock,
  AnalysisOutputEnvelope,
  AnalysisRequestPayload,
  MultimodalInputPart,
} from "./contracts";

export interface MultimodalProviderContext {
  provider: string;
  model: string;
  logger?: (message: string, meta?: Record<string, unknown>) => void;
}

export interface MultimodalNormalizationResult {
  payload: AnalysisRequestPayload;
  mode: "text_only" | "native" | "downgraded";
  consumedParts: number;
  downgradedParts: number;
  reason?: string;
}

function clonePayload(payload: AnalysisRequestPayload): AnalysisRequestPayload {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return { ...payload };
  }
}

function resolveInputParts(payload: AnalysisRequestPayload): MultimodalInputPart[] {
  const fromPrimary = payload?.multimodalInput?.parts;
  if (Array.isArray(fromPrimary)) {
    return fromPrimary;
  }

  const fromSourceContext = payload?.sourceContext?.multimodalInput;
  if (
    fromSourceContext &&
    typeof fromSourceContext === "object" &&
    Array.isArray((fromSourceContext as { parts?: unknown[] }).parts)
  ) {
    return (fromSourceContext as { parts: MultimodalInputPart[] }).parts;
  }

  return [];
}

function supportsNativeMultimodal(_ctx: MultimodalProviderContext): boolean {
  // Current request pipeline is text-first (`streamAIRequest(prompt: string)`).
  // Keep deterministic downgrade until provider-specific multimodal prompt path is added.
  return false;
}

function compactText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function describeSource(part: MultimodalInputPart): string {
  if (compactText(part.name)) return compactText(part.name);
  if (compactText(part.url)) return compactText(part.url);
  if (compactText(part.mimeType)) return compactText(part.mimeType);
  if (compactText(part.base64)) return "base64-inline";
  return "unknown-source";
}

function toDowngradedText(part: MultimodalInputPart): string {
  if (part.type === "text") {
    return compactText(part.text);
  }

  const extracted = compactText(part.extractedText);
  if (extracted) {
    return `[${part.type}] ${extracted}`;
  }

  return `[${part.type}] ${describeSource(part)}`;
}

function appendMultimodalContext(
  payload: AnalysisRequestPayload,
  parts: MultimodalInputPart[],
): AnalysisRequestPayload {
  const nextPayload = clonePayload(payload);
  const lines = parts
    .map((part) => toDowngradedText(part))
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return nextPayload;
  }

  const contextBlock = `\n\n[MULTIMODAL CONTEXT]\n${lines.join("\n")}`;
  const customInfo =
    typeof nextPayload.customInfo === "string" ? nextPayload.customInfo : "";
  nextPayload.customInfo = customInfo ? `${customInfo}${contextBlock}` : contextBlock.trimStart();

  const sourceContext =
    nextPayload.sourceContext && typeof nextPayload.sourceContext === "object"
      ? nextPayload.sourceContext
      : {};
  nextPayload.sourceContext = {
    ...sourceContext,
    multimodalCompat: {
      mode: "downgraded",
      consumedParts: parts.length,
      downgradedParts: parts.filter((part) => part.type !== "text").length,
    },
  };

  return nextPayload;
}

export function normalizeMultimodalInputForProvider(
  payload: AnalysisRequestPayload,
  ctx: MultimodalProviderContext,
): MultimodalNormalizationResult {
  const parts = resolveInputParts(payload);
  if (parts.length === 0) {
    return {
      payload,
      mode: "text_only",
      consumedParts: 0,
      downgradedParts: 0,
    };
  }

  if (supportsNativeMultimodal(ctx)) {
    return {
      payload,
      mode: "native",
      consumedParts: parts.length,
      downgradedParts: 0,
    };
  }

  const downgradedParts = parts.filter((part) => part.type !== "text").length;
  const normalizedPayload = appendMultimodalContext(payload, parts);
  ctx.logger?.("Downgrade multimodal input to text-compatible context.", {
    provider: ctx.provider,
    model: ctx.model,
    consumedParts: parts.length,
    downgradedParts,
  });

  return {
    payload: normalizedPayload,
    mode: "downgraded",
    consumedParts: parts.length,
    downgradedParts,
    reason: "current_pipeline_is_text_only",
  };
}

export function buildAnalysisOutputEnvelope(
  summaryMarkdown: string,
  blocks: AnalysisOutputBlock[] = [],
  rawProviderPayload?: unknown,
): AnalysisOutputEnvelope {
  return {
    summaryMarkdown,
    blocks: Array.isArray(blocks) ? blocks : [],
    rawProviderPayload,
  };
}
