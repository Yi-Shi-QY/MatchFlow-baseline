import { PlanTemplate } from "../../types";

export const fengshuiComprehensiveTemplate: PlanTemplate = {
  id: "fengshui_comprehensive",
  version: "1.0.0",
  name: "Feng Shui Analysis Comprehensive Template",
  description: "Full flow covering site, qi structure, temporal windows, intent constraints, and final recommendation.",
  rule: "Use when site, qi, and temporal sources are all available.",
  requiredAgents: ["fengshui_overview", "fengshui_analysis", "fengshui_general", "fengshui_prediction"],
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
      title: isZh ? "时运窗口" : "Timing Window",
      focus: isZh ? "年度与月度影响的顺逆窗口" : "Assess favorable and caution windows from cycle signals",
      animationType: "tactical",
      agentType: "fengshui_general",
      contextMode: "build_upon",
      sourceIds: ["temporal_cycle"],
    },
    {
      title: isZh ? "目标与约束" : "Intent & Constraints",
      focus: isZh ? "明确优先级、限制条件与可调节空间" : "Clarify priorities, constraints, and adjustment space",
      animationType: "odds",
      agentType: "fengshui_general",
      contextMode: "compare",
      sourceIds: ["occupant_intent"],
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
