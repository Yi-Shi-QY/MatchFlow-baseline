import type { DomainPlannerAdapter, PlannerRuntimeState } from "../runtime";
import {
  buildPlannerGraphFromSegments,
  type PlannerLanguage,
  type PlannerSegmentLike,
} from "./utils";

const FOOTBALL_AGENT_ROLE_LABELS: Record<string, { en: string; zh: string }> = {
  overview: { en: "Overview", zh: "\u603b\u89c8" },
  stats: { en: "Stats", zh: "\u6570\u636e" },
  tactical: { en: "Tactics", zh: "\u6218\u672f" },
  odds: { en: "Market", zh: "\u76d8\u53e3" },
  prediction: { en: "Prediction", zh: "\u9884\u6d4b" },
  general: { en: "General", zh: "\u901a\u7528" },
};

function getAgentRoleLabel(agentType: string | undefined, language: PlannerLanguage): string | null {
  if (!agentType) return null;
  const normalized = agentType.trim().toLowerCase();
  if (!normalized) return null;
  const role = FOOTBALL_AGENT_ROLE_LABELS[normalized];
  if (!role) return null;
  return language === "zh" ? role.zh : role.en;
}

function resolveFootballSegmentLabel(
  segment: unknown,
  index: number,
  language: PlannerLanguage,
): string {
  const fallback = language === "zh" ? `\u8fc7\u7a0b ${index + 1}` : `Phase ${index + 1}`;
  if (!segment || typeof segment !== "object") {
    return fallback;
  }

  const segmentItem = segment as PlannerSegmentLike;
  const title =
    typeof segmentItem.title === "string" && segmentItem.title.trim().length > 0
      ? segmentItem.title.trim()
      : null;
  if (title) return title;

  const roleLabel = getAgentRoleLabel(segmentItem.agentType, language);
  if (roleLabel) return roleLabel;

  return fallback;
}

function mapFootballRuntimeState(input: PlannerRuntimeState): PlannerRuntimeState {
  const stage = input.stage;
  const isSegmentExecutionStage =
    stage === "segment_running" ||
    stage === "animation_generating" ||
    stage === "tag_generating";

  if (!isSegmentExecutionStage) {
    return input;
  }

  const hasSegmentTitle =
    typeof input.activeSegmentTitle === "string" && input.activeSegmentTitle.trim().length > 0;
  if (hasSegmentTitle) {
    return input;
  }

  const roleLabel = getAgentRoleLabel(input.activeAgentId, "en");
  if (!roleLabel) {
    return input;
  }

  if (typeof input.stageLabel === "string" && input.stageLabel.trim().length > 0) {
    return input;
  }

  return {
    ...input,
    stageLabel: roleLabel,
  };
}

export const footballPlannerAdapter: DomainPlannerAdapter = {
  domainId: "football",
  buildGraph: (plan, context) => {
    const segments = Array.isArray(plan) ? plan : [];
    return buildPlannerGraphFromSegments(segments, context.language, resolveFootballSegmentLabel);
  },
  mapRuntimeState: mapFootballRuntimeState,
};
