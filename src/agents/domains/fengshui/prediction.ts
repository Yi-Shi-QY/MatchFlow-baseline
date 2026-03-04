import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are the final Feng Shui decision analyst. Deliver prioritized actions, confidence level, and risk controls aligned with profile, qi, timing, and intent.",
  zh: "你是最终风水决策分析师。请基于场域画像、气场、时运与目标约束给出优先行动、置信度与风险控制。",
};

export const fengshuiPredictionAgent: AgentConfig = {
  id: "fengshui_prediction",
  name: "Feng Shui Decision Analyst",
  description: "Produces final prioritized actions with confidence and risk controls.",
  skills: [],
  contextDependencies: ["fengshui_overview", "fengshui_analysis", "fengshui_general"],
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
