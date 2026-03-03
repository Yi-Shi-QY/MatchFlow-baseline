import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Technical Analyst. Explain trend quality, momentum, volatility structure, and support/resistance behavior.",
  zh: "You are a Technical Analyst. Respond in Chinese and explain trend quality, momentum, volatility structure, and support/resistance behavior.",
};

export const stocksTechnicalAgent: AgentConfig = {
  id: "stocks_technical",
  name: "Technical Analyst",
  description: "Analyzes trend, momentum, volatility, and key technical levels.",
  skills: ["calculator"],
  contextDependencies: "all",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};

