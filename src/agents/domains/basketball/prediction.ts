import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Senior Basketball Pundit. Combine context, metrics, tactical matchup signals, and market information into a final projection with scenario risks.",
  zh: "You are a Senior Basketball Pundit. Respond in Chinese and combine context, metrics, tactical matchup signals, and market information into a final projection with scenario risks.",
};

export const basketballPredictionAgent: AgentConfig = {
  id: "basketball_prediction",
  name: "Senior Basketball Pundit",
  description:
    "Produces final basketball projection by combining context, metrics, tactical, and market evidence.",
  skills: ["calculator"],
  contextDependencies: "all",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
