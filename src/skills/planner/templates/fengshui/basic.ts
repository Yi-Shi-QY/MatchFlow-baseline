import { PlanTemplate } from "../../types";

export const fengshuiBasicTemplate: PlanTemplate = {
  id: "fengshui_basic",
  version: "1.0.0",
  name: "Feng Shui Analysis Basic Template",
  description: "Minimal flow with overview and final recommendation.",
  rule: "Use when data is limited or user wants a quick output.",
  requiredAgents: ["fengshui_overview", "fengshui_prediction"],
  requiredSkills: [],
  getSegments: (isZh: boolean) => [
    {
      title: isZh ? "场域概览" : "Site Overview",
      focus: isZh ? "主体背景、朝向与用途约束" : "Subject setup, orientation, and usage constraints",
      animationType: "none",
      agentType: "fengshui_overview",
      contextMode: "independent",
      sourceIds: ["site_profile"],
    },
    {
      title: isZh ? "最终结论" : "Final Recommendation",
      focus: isZh ? "综合气场、时运与目标给出执行建议" : "Synthesize qi, timing, and intent into action guidance",
      animationType: "none",
      agentType: "fengshui_prediction",
      contextMode: "all",
      sourceIds: ["site_profile", "qi_flow", "temporal_cycle", "occupant_intent"],
    },
  ],
};
