import type { PlannerGraph, PlannerStage } from "../runtime";

export type PlannerLanguage = "zh" | "en";

export interface PlannerSegmentLike {
  title?: string;
  focus?: string;
  agentType?: string;
}

export const PLANNER_MACRO_STAGE_SEQUENCE: PlannerStage[] = [
  "booting",
  "planning",
  "segment_running",
  "animation_generating",
  "tag_generating",
  "summary_generating",
  "finalizing",
  "completed",
];

const PLANNER_MACRO_STAGE_LABELS: Record<PlannerLanguage, Record<PlannerStage, string>> = {
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
    booting: "\u542f\u52a8",
    planning: "\u89c4\u5212",
    segment_running: "\u5206\u6bb5",
    animation_generating: "\u52a8\u753b",
    tag_generating: "\u6807\u7b7e",
    summary_generating: "\u603b\u7ed3",
    finalizing: "\u6536\u5c3e",
    completed: "\u5b8c\u6210",
    failed: "\u5931\u8d25",
    cancelled: "\u53d6\u6d88",
  },
};

function safeSegmentCount(input: unknown[]): number {
  if (!Array.isArray(input)) return 0;
  return Math.max(0, Math.floor(input.length));
}

function getFallbackSegmentLabel(index: number, language: PlannerLanguage): string {
  if (language === "zh") {
    return `\u6bb5 ${index + 1}`;
  }
  return `Seg ${index + 1}`;
}

function resolveSegmentTitle(segment: unknown): string | null {
  if (!segment || typeof segment !== "object") return null;
  const raw = (segment as PlannerSegmentLike).title;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getPlannerMacroStageLabel(
  stage: PlannerStage,
  language: PlannerLanguage,
): string {
  return PLANNER_MACRO_STAGE_LABELS[language][stage] || stage;
}

export function buildPlannerGraphFromSegments(
  segments: unknown[],
  language: PlannerLanguage,
  resolveSegmentLabel?: (segment: unknown, index: number, language: PlannerLanguage) => string,
): PlannerGraph {
  const totalSegments = safeSegmentCount(segments);
  const nodes: PlannerGraph["nodes"] = [];
  const edges: PlannerGraph["edges"] = [];

  PLANNER_MACRO_STAGE_SEQUENCE.forEach((stage) => {
    nodes.push({
      id: `stage:${stage}`,
      label: getPlannerMacroStageLabel(stage, language),
      kind: "stage",
      weight: 1,
    });
  });

  for (let i = 0; i < totalSegments; i++) {
    const segment = segments[i];
    const label =
      typeof resolveSegmentLabel === "function"
        ? resolveSegmentLabel(segment, i, language)
        : resolveSegmentTitle(segment) || getFallbackSegmentLabel(i, language);
    nodes.push({
      id: `segment:${i}`,
      label: label && label.trim().length > 0 ? label.trim() : getFallbackSegmentLabel(i, language),
      kind: "segment",
      weight: 1,
    });
  }

  for (let i = 0; i < PLANNER_MACRO_STAGE_SEQUENCE.length - 1; i++) {
    edges.push({
      id: `edge:stage:${PLANNER_MACRO_STAGE_SEQUENCE[i]}->${PLANNER_MACRO_STAGE_SEQUENCE[i + 1]}`,
      from: `stage:${PLANNER_MACRO_STAGE_SEQUENCE[i]}`,
      to: `stage:${PLANNER_MACRO_STAGE_SEQUENCE[i + 1]}`,
    });
  }

  if (totalSegments > 0) {
    edges.push({
      id: "edge:planning->segment:0",
      from: "stage:planning",
      to: "segment:0",
    });

    for (let i = 0; i < totalSegments - 1; i++) {
      edges.push({
        id: `edge:segment:${i}->segment:${i + 1}`,
        from: `segment:${i}`,
        to: `segment:${i + 1}`,
      });
    }

    edges.push({
      id: `edge:segment:${totalSegments - 1}->summary`,
      from: `segment:${totalSegments - 1}`,
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
