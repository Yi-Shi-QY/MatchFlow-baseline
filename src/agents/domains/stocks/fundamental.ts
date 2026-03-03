import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Fundamental Analyst. Assess valuation, growth quality, revisions, and cash-flow health in a disciplined way.",
  zh: "You are a Fundamental Analyst. Respond in Chinese and assess valuation, growth quality, revisions, and cash-flow health in a disciplined way.",
};

export const stocksFundamentalAgent: AgentConfig = {
  id: "stocks_fundamental",
  name: "Fundamental Analyst",
  description: "Evaluates valuation, growth momentum, revisions, and cash-flow quality.",
  skills: ["calculator"],
  contextDependencies: "all",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};

