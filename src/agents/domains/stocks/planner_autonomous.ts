import { AgentConfig } from "../../types";
import {
  buildAutonomousPlannerPrompt,
  resolveAnalysisTarget,
} from "../../autonomousPlannerPrompt";

const STOCKS_FALLBACK_AGENTS = [
  "stocks_overview",
  "stocks_technical",
  "stocks_fundamental",
  "stocks_risk",
  "stocks_prediction",
  "stocks_general",
];

const STOCKS_FALLBACK_ANIMATIONS = ["stats", "comparison", "none"];
const STOCKS_FALLBACK_SOURCES = [
  "asset_profile",
  "price_action",
  "valuation_health",
  "risk_events",
];

export const stocksPlannerAutonomousAgent: AgentConfig = {
  id: "stocks_planner_autonomous",
  name: "Stocks Autonomous Planner",
  description: "Builds custom stock-analysis segment plans.",
  skills: [],
  systemPrompt: (context) => {
    const language = context.language === "zh" ? "zh" : "en";
    const target = resolveAnalysisTarget(context.matchData, language);

    return buildAutonomousPlannerPrompt({
      context,
      language,
      domainId: "stocks",
      target,
      plannerTitle: "Senior Equity Analysis Director",
      fallbackAgentTypes: STOCKS_FALLBACK_AGENTS,
      fallbackAnimationTypes: STOCKS_FALLBACK_ANIMATIONS,
      fallbackSourceIds: STOCKS_FALLBACK_SOURCES,
      extraInstructions: [
        "Keep a narrative flow from setup -> signal analysis -> risk evaluation -> final recommendation.",
        "Use compare context mode when reconciling technical and fundamental views.",
      ],
    });
  },
};
