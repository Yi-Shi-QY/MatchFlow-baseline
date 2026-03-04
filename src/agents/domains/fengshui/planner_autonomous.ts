import { AgentConfig } from "../../types";
import {
  buildAutonomousPlannerPrompt,
  resolveAnalysisTarget,
} from "../../autonomousPlannerPrompt";

const FENGSHUI_FALLBACK_AGENTS = [
  "fengshui_overview",
  "fengshui_analysis",
  "fengshui_prediction",
  "fengshui_general",
];

const FENGSHUI_FALLBACK_ANIMATIONS = ["stats", "comparison", "tactical", "odds", "none"];
const FENGSHUI_FALLBACK_SOURCES = [
  "site_profile",
  "qi_flow",
  "temporal_cycle",
  "occupant_intent",
];

export const fengshuiPlannerAutonomousAgent: AgentConfig = {
  id: "fengshui_planner_autonomous",
  name: "Feng Shui Autonomous Planner",
  description: "Builds custom Feng Shui segment plans with source routing.",
  skills: [],
  systemPrompt: (context) => {
    const language = context.language === "zh" ? "zh" : "en";
    const target = resolveAnalysisTarget(context.matchData, language);

    return buildAutonomousPlannerPrompt({
      context,
      language,
      domainId: "fengshui",
      target,
      plannerTitle: "Feng Shui Advisory Planning Director",
      fallbackAgentTypes: FENGSHUI_FALLBACK_AGENTS,
      fallbackAnimationTypes: FENGSHUI_FALLBACK_ANIMATIONS,
      fallbackSourceIds: FENGSHUI_FALLBACK_SOURCES,
      extraInstructions: [
        "Balance site profile, qi flow, temporal cycle, and occupant intent across segments.",
        "Reserve the final segment for integrated recommendation and execution priorities.",
      ],
    });
  },
};
