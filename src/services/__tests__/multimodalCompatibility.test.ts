import { describe, expect, it } from "vitest";
import type { AnalysisRequestPayload } from "@/src/services/ai/contracts";
import { normalizeMultimodalInputForProvider } from "@/src/services/ai/multimodalCompatibility";

describe("multimodal compatibility normalization", () => {
  it("keeps text-only payload unchanged", () => {
    const payload: AnalysisRequestPayload = {
      id: "match_text_only",
      customInfo: "plain text context",
    };
    const result = normalizeMultimodalInputForProvider(payload, {
      provider: "gemini",
      model: "gemini-3-flash-preview",
    });

    expect(result.mode).toBe("text_only");
    expect(result.consumedParts).toBe(0);
    expect(result.downgradedParts).toBe(0);
    expect(result.payload.customInfo).toBe("plain text context");
  });

  it("downgrades mixed multimodal parts to deterministic text context", () => {
    const payload: AnalysisRequestPayload = {
      id: "match_mixed_modal",
      sourceContext: {
        domainId: "football",
      },
      multimodalInput: {
        parts: [
          { type: "text", text: "focus on defensive transitions" },
          {
            type: "image",
            url: "https://example.com/frame.png",
            extractedText: "heatmap shows right-side overload",
          },
          {
            type: "audio",
            name: "coach-note.m4a",
          },
        ],
      },
    };

    const result = normalizeMultimodalInputForProvider(payload, {
      provider: "openai_compatible",
      model: "gpt-4o-mini",
    });

    expect(result.mode).toBe("downgraded");
    expect(result.consumedParts).toBe(3);
    expect(result.downgradedParts).toBe(2);
    expect(String(result.payload.customInfo || "")).toContain("[MULTIMODAL CONTEXT]");
    expect(String(result.payload.customInfo || "")).toContain(
      "focus on defensive transitions",
    );
    expect(String(result.payload.customInfo || "")).toContain(
      "heatmap shows right-side overload",
    );
    expect(
      (result.payload.sourceContext as Record<string, unknown>).multimodalCompat,
    ).toBeTruthy();
  });
});
