import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Senior Basketball Analyst. Provide structured, evidence-based basketball insights with practical conclusions.",
  zh: "You are a Senior Basketball Analyst. Respond in Chinese and provide structured, evidence-based basketball insights with practical conclusions.",
};

export const basketballGeneralAgent: AgentConfig = {
  id: "basketball_general",
  name: "Senior Basketball Analyst",
  description: "General-purpose basketball analysis with domain-specific framing.",
  skills: [],
  contextDependencies: "all",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
