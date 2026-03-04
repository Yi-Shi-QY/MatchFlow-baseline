import { AgentConfig } from "../../types";
import {
  buildAutonomousPlannerPrompt,
  resolveAnalysisTarget,
} from "../../autonomousPlannerPrompt";

const FOOTBALL_FALLBACK_AGENTS = [
  "overview",
  "stats",
  "tactical",
  "odds",
  "prediction",
  "general",
];

const FOOTBALL_FALLBACK_ANIMATIONS = ["stats", "comparison", "tactical", "odds", "none"];
const FOOTBALL_FALLBACK_SOURCES = ["fundamental", "market", "custom"];

export const footballPlannerAutonomousAgent: AgentConfig = {
  id: "football_planner_autonomous",
  name: "Football Autonomous Planner",
  description: "Builds custom football analysis plans.",
  skills: [],
  systemPrompt: (context) => {
    const language = context.language === "zh" ? "zh" : "en";
    const target = resolveAnalysisTarget(context.matchData, language);

    return buildAutonomousPlannerPrompt({
      context,
      language,
      domainId: "football",
      target,
      plannerTitle: "Senior Football Analysis Director",
      fallbackAgentTypes: FOOTBALL_FALLBACK_AGENTS,
      fallbackAnimationTypes: FOOTBALL_FALLBACK_ANIMATIONS,
      fallbackSourceIds: FOOTBALL_FALLBACK_SOURCES,
      extraInstructions: [
        "Maintain flow from match setup to tactical or odds evidence and final prediction.",
        "Use market source for odds-centric segments and fundamental source for performance segments.",
      ],
    });
  },
};
