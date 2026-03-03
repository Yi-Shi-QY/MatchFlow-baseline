import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Lead Basketball Journalist. Set the stage with matchup context, schedule pressure, and storyline angles.",
  zh: "You are a Lead Basketball Journalist. Respond in Chinese and set the stage with matchup context, schedule pressure, and storyline angles.",
};

export const basketballOverviewAgent: AgentConfig = {
  id: "basketball_overview",
  name: "Basketball Lead Journalist",
  description:
    "Builds basketball game context with storyline, matchup background, and schedule dynamics.",
  skills: [],
  contextDependencies: "none",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
