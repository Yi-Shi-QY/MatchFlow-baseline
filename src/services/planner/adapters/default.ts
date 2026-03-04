import type { DomainPlannerAdapter } from "../runtime";
import {
  buildPlannerGraphFromSegments,
  type PlannerLanguage,
  type PlannerSegmentLike,
} from "./utils";

function resolveDefaultSegmentLabel(
  segment: unknown,
  index: number,
  language: PlannerLanguage,
): string {
  if (segment && typeof segment === "object") {
    const rawTitle = (segment as PlannerSegmentLike).title;
    if (typeof rawTitle === "string" && rawTitle.trim().length > 0) {
      return rawTitle.trim();
    }
  }
  if (language === "zh") {
    return `\u5206\u6bb5 ${index + 1}`;
  }
  return `Segment ${index + 1}`;
}

export const defaultPlannerAdapter: DomainPlannerAdapter = {
  domainId: "default",
  buildGraph: (plan, context) => {
    const segments = Array.isArray(plan) ? plan : [];
    return buildPlannerGraphFromSegments(segments, context.language, resolveDefaultSegmentLabel);
  },
};
