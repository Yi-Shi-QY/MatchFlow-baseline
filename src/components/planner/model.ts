import type { PlannerGraph, PlannerRuntimeState, PlannerStage } from "@/src/services/planner/runtime";

export type PlannerLanguage = "zh" | "en";

export type PlannerNodeVisualState = "pending" | "running" | "completed" | "failed" | "cancelled";

export const MACRO_STAGE_SEQUENCE: PlannerStage[] = [
  "booting",
  "planning",
  "segment_running",
  "animation_generating",
  "tag_generating",
  "summary_generating",
  "finalizing",
  "completed",
];

const MACRO_STAGE_LABELS: Record<PlannerLanguage, Record<PlannerStage, string>> = {
  en: {
    booting: "Booting",
    planning: "Planning",
    segment_running: "Segment",
    animation_generating: "Animation",
    tag_generating: "Tags",
    summary_generating: "Summary",
    finalizing: "Finalizing",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  },
  zh: {
    booting: "启动",
    planning: "规划",
    segment_running: "分段执行",
    animation_generating: "动画",
    tag_generating: "标签",
    summary_generating: "总结",
    finalizing: "收尾",
    completed: "完成",
    failed: "失败",
    cancelled: "取消",
  },
};

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
  return MACRO_STAGE_LABELS[language][stage] || stage;
}

export function buildDefaultPlannerGraph(
  totalSegments: number,
  language: PlannerLanguage,
): PlannerGraph {
  const safeTotal = Math.max(0, Math.floor(totalSegments));
  const nodes: PlannerGraph["nodes"] = [];
  const edges: PlannerGraph["edges"] = [];

  MACRO_STAGE_SEQUENCE.forEach((stage) => {
    nodes.push({
      id: `stage:${stage}`,
      label: getMacroStageLabel(stage, language),
      kind: "stage",
      weight: 1,
    });
  });

  for (let i = 0; i < safeTotal; i++) {
    nodes.push({
      id: `segment:${i}`,
      label: language === "zh" ? `段 ${i + 1}` : `Seg ${i + 1}`,
      kind: "segment",
      weight: 1,
    });
  }

  for (let i = 0; i < MACRO_STAGE_SEQUENCE.length - 1; i++) {
    edges.push({
      id: `edge:stage:${MACRO_STAGE_SEQUENCE[i]}->${MACRO_STAGE_SEQUENCE[i + 1]}`,
      from: `stage:${MACRO_STAGE_SEQUENCE[i]}`,
      to: `stage:${MACRO_STAGE_SEQUENCE[i + 1]}`,
    });
  }

  if (safeTotal > 0) {
    edges.push({
      id: "edge:planning->segment:0",
      from: "stage:planning",
      to: "segment:0",
    });

    for (let i = 0; i < safeTotal - 1; i++) {
      edges.push({
        id: `edge:segment:${i}->segment:${i + 1}`,
        from: `segment:${i}`,
        to: `segment:${i + 1}`,
      });
    }

    edges.push({
      id: `edge:segment:${safeTotal - 1}->summary`,
      from: `segment:${safeTotal - 1}`,
      to: "stage:summary_generating",
    });
  } else {
    edges.push({
      id: "edge:planning->summary",
      from: "stage:planning",
      to: "stage:summary_generating",
    });
  }

  return { nodes, edges };
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
