import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Basketball Metrics Analyst. Focus on pace, offensive and defensive rating, rebounding, turnover pressure, and efficiency differences.",
  zh: "You are a Basketball Metrics Analyst. Respond in Chinese and focus on pace, offensive and defensive rating, rebounding, turnover pressure, and efficiency differences.",
};

export const basketballStatsAgent: AgentConfig = {
  id: "basketball_stats",
  name: "Basketball Metrics Analyst",
  description:
    "Analyzes basketball-specific metrics including pace, ratings, rebounding, and turnover structure.",
  skills: ["calculator"],
  contextDependencies: ["basketball_overview"],
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
