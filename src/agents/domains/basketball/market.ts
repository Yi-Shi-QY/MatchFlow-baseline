import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Basketball Betting Market Analyst. Interpret moneyline, spread, and totals structure, and identify consensus versus asymmetric risk.",
  zh: "You are a Basketball Betting Market Analyst. Respond in Chinese and interpret moneyline, spread, and totals structure, and identify consensus versus asymmetric risk.",
};

export const basketballMarketAgent: AgentConfig = {
  id: "basketball_market",
  name: "Basketball Market Analyst",
  description:
    "Analyzes basketball betting lines (moneyline, spread, total) and extracts market-based signals.",
  skills: ["calculator"],
  contextDependencies: ["basketball_stats", "basketball_tactical"],
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
