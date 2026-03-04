import { PlanTemplate } from "../../types";

export const fengshuiFocusedTemplate: PlanTemplate = {
  id: "fengshui_focused",
  version: "1.0.0",
  name: "Feng Shui Analysis Focused Template",
  description: "Timing-focused flow for cycle-heavy and constraint-heavy scenarios.",
  rule: "Use when temporal-cycle signals dominate the available data.",
  requiredAgents: ["fengshui_analysis", "fengshui_general", "fengshui_prediction"],
  requiredSkills: [],
  getSegments: (isZh: boolean) => [
    {
      title: isZh ? "时运窗口" : "Timing Window",
      focus: isZh ? "年度与月度影响的顺逆窗口" : "Assess favorable and caution windows from cycle signals",
      animationType: "odds",
      agentType: "fengshui_analysis",
      contextMode: "independent",
      sourceIds: ["temporal_cycle"],
    },
    {
      title: isZh ? "目标与约束" : "Intent & Constraints",
      focus: isZh ? "明确优先级、限制条件与可调节空间" : "Clarify priorities, constraints, and adjustment space",
      animationType: "none",
      agentType: "fengshui_general",
      contextMode: "build_upon",
      sourceIds: ["occupant_intent"],
    },
    {
      title: isZh ? "行动建议" : "Action Plan",
      focus: isZh ? "结合时运与目标给出执行顺序" : "Sequence concrete actions by timing and intent alignment",
      animationType: "none",
      agentType: "fengshui_prediction",
      contextMode: "all",
      sourceIds: ["site_profile", "temporal_cycle", "occupant_intent"],
    },
  ],
};
