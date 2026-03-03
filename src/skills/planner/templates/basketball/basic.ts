import { PlanTemplate } from "../../types";

export const basketballBasicTemplate: PlanTemplate = {
  id: "basketball_basic",
  version: "1.0.0",
  name: "Basketball Basic Template",
  description: "Quick basketball briefing with context and final projection.",
  rule: "Use when basketball input is limited or the user wants a concise answer.",
  requiredAgents: ["basketball_overview", "basketball_prediction"],
  requiredSkills: [],
  getSegments: (_isZh: boolean) => [
    {
      title: "Game Context",
      focus: "Schedule context, storyline, and matchup frame",
      animationType: "none",
      agentType: "basketball_overview",
      contextMode: "independent",
    },
    {
      title: "Final Projection",
      focus: "Final projection with primary risk flags",
      animationType: "none",
      agentType: "basketball_prediction",
      contextMode: "all",
    },
  ],
};
