import { PlanTemplate } from "../../types";

export const fengshuiStandardTemplate: PlanTemplate = {
  id: "fengshui_standard",
  version: "1.0.0",
  name: "Feng Shui Analysis Standard Template",
  description: "Balanced flow for site + qi evaluation with final recommendation.",
  rule: "Use as default when qi-flow data is available.",
  requiredAgents: ["fengshui_overview", "fengshui_analysis", "fengshui_prediction"],
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
      title: isZh ? "气场结构" : "Qi Structure",
      focus: isZh ? "明堂、流通与煞压结构评估" : "Evaluate bright hall, circulation, and pressure structure",
      animationType: "stats",
      agentType: "fengshui_analysis",
      contextMode: "build_upon",
      sourceIds: ["qi_flow"],
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
