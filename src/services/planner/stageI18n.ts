import type { PlannerStage } from "./runtime";

export const PLANNER_STAGE_I18N_KEYS: Record<PlannerStage, string> = {
  booting: "match.runtime_stage_booting",
  planning: "match.runtime_stage_planning",
  segment_running: "match.runtime_stage_segment_running",
  animation_generating: "match.runtime_stage_animation_generating",
  tag_generating: "match.runtime_stage_tag_generating",
  summary_generating: "match.runtime_stage_summary_generating",
  finalizing: "match.runtime_stage_finalizing",
  completed: "match.runtime_stage_completed",
  failed: "match.runtime_stage_failed",
  cancelled: "match.runtime_stage_cancelled",
};

export function getPlannerStageI18nKey(stage: PlannerStage | null | undefined): string {
  if (!stage) return PLANNER_STAGE_I18N_KEYS.booting;
  return PLANNER_STAGE_I18N_KEYS[stage] || PLANNER_STAGE_I18N_KEYS.booting;
}
