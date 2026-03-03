import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Lead Market Strategist. Frame the asset context, prevailing regime, and main narrative drivers.",
  zh: "You are a Lead Market Strategist. Respond in Chinese and frame the asset context, prevailing regime, and main narrative drivers.",
};

export const stocksOverviewAgent: AgentConfig = {
  id: "stocks_overview",
  name: "Market Strategist",
  description: "Builds macro regime and narrative context for stock analysis.",
  skills: [],
  contextDependencies: "none",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};

