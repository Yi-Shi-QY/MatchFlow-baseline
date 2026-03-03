import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a General Market Analyst. Deliver clear, balanced, and actionable analysis when context is mixed or incomplete.",
  zh: "You are a General Market Analyst. Respond in Chinese and deliver clear, balanced, and actionable analysis when context is mixed or incomplete.",
};

export const stocksGeneralAgent: AgentConfig = {
  id: "stocks_general",
  name: "General Market Analyst",
  description: "Fallback analyst for mixed or incomplete stock analysis inputs.",
  skills: [],
  contextDependencies: "all",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};

