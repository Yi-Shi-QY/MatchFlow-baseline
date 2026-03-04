import type { PlannerGraph, PlannerRuntimeState, PlannerStage } from "@/src/services/planner/runtime";
import {
  PLANNER_MACRO_STAGE_SEQUENCE,
  buildPlannerGraphFromSegments,
  getPlannerMacroStageLabel,
  type PlannerLanguage,
} from "@/src/services/planner/adapters/utils";

export type { PlannerLanguage };

export type PlannerNodeVisualState = "pending" | "running" | "completed" | "failed" | "cancelled";

export const MACRO_STAGE_SEQUENCE: PlannerStage[] = PLANNER_MACRO_STAGE_SEQUENCE;

const STAGE_RANK: Record<PlannerStage, number> = {
  booting: 0,
  planning: 1,
  segment_running: 2,
  animation_generating: 3,
  tag_generating: 4,
  summary_generating: 5,
  finalizing: 6,
  completed: 7,
  failed: 6,
  cancelled: 6,
};

export function getMacroStageLabel(stage: PlannerStage, language: PlannerLanguage): string {
  return getPlannerMacroStageLabel(stage, language);
}

export function buildDefaultPlannerGraph(
  totalSegments: number,
  language: PlannerLanguage,
): PlannerGraph {
  const safeTotal = Math.max(0, Math.floor(totalSegments));
  const placeholderSegments = Array.from({ length: safeTotal }, () => ({}));
  return buildPlannerGraphFromSegments(placeholderSegments, language);
}

function toCoreRuntimeStage(stage: PlannerStage): PlannerStage {
  if (stage === "failed" || stage === "cancelled") {
    return "finalizing";
  }
  return stage;
}

export function getMacroStageVisualState(
  macroStage: PlannerStage,
  runtimeState: PlannerRuntimeState,
): PlannerNodeVisualState {
  if (runtimeState.stage === "failed" && macroStage === "finalizing") {
    return "failed";
  }
  if (runtimeState.stage === "cancelled" && macroStage === "finalizing") {
    return "cancelled";
  }

  const runtimeCore = toCoreRuntimeStage(runtimeState.stage);
  const runtimeRank = STAGE_RANK[runtimeCore];
  const nodeRank = STAGE_RANK[macroStage];
  if (nodeRank < runtimeRank) return "completed";
  if (nodeRank === runtimeRank) return "running";
  return "pending";
}

export function getSegmentVisualState(
  segmentIndex: number,
  runtimeState: PlannerRuntimeState,
  totalSegments: number,
): PlannerNodeVisualState {
  const safeTotal = Math.max(0, totalSegments);
  if (segmentIndex < 0 || segmentIndex >= safeTotal) return "pending";

  const completedSegments = Math.max(
    0,
    Math.min(safeTotal, Math.floor(runtimeState.segmentIndex)),
  );

  if (runtimeState.stage === "completed") {
    return "completed";
  }

  if (segmentIndex < completedSegments) {
    return "completed";
  }

  if (segmentIndex > completedSegments) {
    return "pending";
  }

  const stage = runtimeState.stage;
  if (
    stage === "segment_running" ||
    stage === "animation_generating" ||
    stage === "tag_generating"
  ) {
    return "running";
  }
  if (stage === "failed") return "failed";
  if (stage === "cancelled") return "cancelled";
  if (stage === "summary_generating" || stage === "finalizing") return "completed";

  return "pending";
}

export function resolvePlannerHudStageLabel(
  runtimeState: PlannerRuntimeState,
  language: PlannerLanguage,
): string {
  if (typeof runtimeState.stageLabel === "string" && runtimeState.stageLabel.trim().length > 0) {
    return runtimeState.stageLabel.trim();
  }
  return getMacroStageLabel(runtimeState.stage, language);
}
