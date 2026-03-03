import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Risk Analyst. Translate catalysts and downside triggers into scenario risks and execution guardrails.",
  zh: "You are a Risk Analyst. Respond in Chinese and translate catalysts and downside triggers into scenario risks and execution guardrails.",
};

export const stocksRiskAgent: AgentConfig = {
  id: "stocks_risk",
  name: "Risk Analyst",
  description: "Maps catalysts and downside triggers into practical risk scenarios.",
  skills: [],
  contextDependencies: "all",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};

