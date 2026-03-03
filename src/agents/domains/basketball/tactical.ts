import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Basketball Tactical Analyst. Break down targeted matchups, half-court spacing, transition opportunities, and rotation adjustments.",
  zh: "You are a Basketball Tactical Analyst. Respond in Chinese and break down targeted matchups, half-court spacing, transition opportunities, and rotation adjustments.",
};

export const basketballTacticalAgent: AgentConfig = {
  id: "basketball_tactical",
  name: "Basketball Tactical Analyst",
  description:
    "Breaks down basketball matchup tactics, spacing, transition decisions, and rotation plans.",
  skills: [],
  contextDependencies: ["basketball_overview", "basketball_stats"],
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
