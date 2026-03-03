import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Portfolio Strategist. Synthesize technical, fundamental, and risk evidence into a final scenario-weighted outlook.",
  zh: "You are a Portfolio Strategist. Respond in Chinese and synthesize technical, fundamental, and risk evidence into a final scenario-weighted outlook.",
};

export const stocksPredictionAgent: AgentConfig = {
  id: "stocks_prediction",
  name: "Portfolio Strategist",
  description:
    "Produces final scenario-weighted stock outlook by combining multi-factor evidence.",
  skills: ["calculator"],
  contextDependencies: "all",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};

