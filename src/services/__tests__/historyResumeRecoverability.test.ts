import { describe, expect, it } from "vitest";
import type { NormalizedPlanSegment } from "@/src/services/ai/contracts";
import {
  isResumeStateRecoverable,
  type SavedResumeState,
} from "@/src/services/history";

const basePlan: NormalizedPlanSegment[] = [
  {
    title: "Segment A",
    focus: "Test focus",
    animationType: "none",
    agentType: "general",
  },
];

function buildBaseSavedState(overrides?: Partial<SavedResumeState>): SavedResumeState {
  return {
    domainId: "football",
    subjectId: "match_1",
    subjectType: "match",
    thoughts: "partial analysis text",
    timestamp: Date.now(),
    state: {
      plan: basePlan,
      completedSegmentIndices: [],
      fullAnalysisText: "partial analysis text",
    },
    ...(overrides || {}),
  };
}

describe("history resume recoverability", () => {
  it("returns true for unfinished analysis artifacts", () => {
    const state = buildBaseSavedState();
    expect(isResumeStateRecoverable(state)).toBe(true);
  });

  it("remains recoverable for unfinished subject-route artifacts beyond match-first subject types", () => {
    const state = buildBaseSavedState({
      subjectId: "subject_42",
      subjectType: "team_report",
    });
    expect(isResumeStateRecoverable(state)).toBe(true);
  });

  it("returns false when runtime stage is completed", () => {
    const state = buildBaseSavedState({
      state: {
        plan: basePlan,
        completedSegmentIndices: [0],
        fullAnalysisText: "done",
        runtimeStatus: { stage: "completed" } as any,
      },
    });
    expect(isResumeStateRecoverable(state)).toBe(false);
  });

  it("returns false when there are no recoverable artifacts", () => {
    const state = buildBaseSavedState({
      thoughts: "",
      state: {
        plan: [],
        completedSegmentIndices: [],
        fullAnalysisText: "",
        segmentResults: [],
      },
    });
    expect(isResumeStateRecoverable(state)).toBe(false);
  });
});
