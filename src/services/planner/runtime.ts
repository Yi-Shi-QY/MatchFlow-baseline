export type PlannerStage =
  | "booting"
  | "planning"
  | "segment_running"
  | "animation_generating"
  | "tag_generating"
  | "summary_generating"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled";

export interface PlannerRuntimeState {
  stage: PlannerStage;
  runId: string;
  timestamp: number;
  segmentIndex: number;
  totalSegments: number;
  stageLabel?: string;
  activeAgentId?: string;
  activeSegmentTitle?: string;
  progressPercent: number;
  errorMessage?: string;
}

export interface PlannerNode {
  id: string;
  label: string;
  kind: "stage" | "segment";
  weight?: number;
}

export interface PlannerEdge {
  id: string;
  from: string;
  to: string;
}

export interface PlannerGraph {
  nodes: PlannerNode[];
  edges: PlannerEdge[];
}

export interface DomainPlannerAdapter {
  domainId: string;
  buildGraph: (plan: any[], context: { language: "zh" | "en" }) => PlannerGraph;
  mapRuntimeState?: (input: PlannerRuntimeState) => PlannerRuntimeState;
}

interface PlannerProgressInput {
  stage: PlannerStage;
  segmentIndex?: number;
  totalSegments?: number;
}

interface PlannerRuntimeStateInput {
  stage: PlannerStage;
  runId: string;
  segmentIndex?: number;
  totalSegments?: number;
  stageLabel?: string;
  activeAgentId?: string;
  activeSegmentTitle?: string;
  progressPercent?: number;
  errorMessage?: string;
  timestamp?: number;
}

function toSafeNonNegativeInt(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value as number));
}

export function clampPlannerProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function derivePlannerProgressPercent(input: PlannerProgressInput): number {
  const totalSegments = toSafeNonNegativeInt(input.totalSegments);
  const segmentIndex = toSafeNonNegativeInt(input.segmentIndex);
  const boundedSegmentIndex =
    totalSegments > 0 ? Math.min(segmentIndex, totalSegments) : segmentIndex;
  const baseProgress =
    totalSegments > 0 ? Math.floor((boundedSegmentIndex / totalSegments) * 100) : 0;

  switch (input.stage) {
    case "booting":
      return 0;
    case "planning":
      return 3;
    case "segment_running":
      return Math.min(94, baseProgress);
    case "animation_generating":
      return Math.min(95, baseProgress + 1);
    case "tag_generating":
      return Math.min(96, baseProgress + 2);
    case "summary_generating":
      return totalSegments > 0 ? Math.max(baseProgress, 92) : 92;
    case "finalizing":
      return totalSegments > 0 ? Math.max(baseProgress, 97) : 97;
    case "completed":
      return 100;
    case "failed":
    case "cancelled":
      return Math.min(99, baseProgress);
    default:
      return baseProgress;
  }
}

export function buildPlannerRuntimeState(input: PlannerRuntimeStateInput): PlannerRuntimeState {
  const totalSegments = toSafeNonNegativeInt(input.totalSegments);
  const segmentIndex = totalSegments > 0
    ? Math.min(toSafeNonNegativeInt(input.segmentIndex), totalSegments)
    : toSafeNonNegativeInt(input.segmentIndex);

  const stageLabel =
    typeof input.stageLabel === "string" && input.stageLabel.trim().length > 0
      ? input.stageLabel.trim()
      : undefined;
  const activeAgentId =
    typeof input.activeAgentId === "string" && input.activeAgentId.trim().length > 0
      ? input.activeAgentId.trim()
      : undefined;
  const activeSegmentTitle =
    typeof input.activeSegmentTitle === "string" && input.activeSegmentTitle.trim().length > 0
      ? input.activeSegmentTitle.trim()
      : undefined;
  const errorMessage =
    typeof input.errorMessage === "string" && input.errorMessage.trim().length > 0
      ? input.errorMessage.trim()
      : undefined;

  const progressPercent =
    typeof input.progressPercent === "number"
      ? clampPlannerProgress(input.progressPercent)
      : derivePlannerProgressPercent({
          stage: input.stage,
          segmentIndex,
          totalSegments,
        });

  return {
    stage: input.stage,
    runId: input.runId,
    timestamp: typeof input.timestamp === "number" ? input.timestamp : Date.now(),
    segmentIndex,
    totalSegments,
    stageLabel,
    activeAgentId,
    activeSegmentTitle,
    progressPercent,
    errorMessage,
  };
}

export function createPlannerRunId(prefix: string = "planner"): string {
  const safePrefix = prefix.trim().length > 0 ? prefix.trim() : "planner";
  return `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
