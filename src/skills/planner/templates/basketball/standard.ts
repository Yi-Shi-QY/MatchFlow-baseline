import { PlanTemplate } from "../../types";

export const basketballStandardTemplate: PlanTemplate = {
  id: "basketball_standard",
  version: "1.0.0",
  name: "Basketball Standard Template",
  description: "Balanced basketball analysis with context, metrics, matchup, and projection.",
  rule: "Use as the default basketball plan when core context and metric data are available.",
  requiredAgents: [
    "basketball_overview",
    "basketball_stats",
    "basketball_tactical",
    "basketball_prediction",
  ],
  requiredSkills: [],
  getSegments: (_isZh: boolean) => [
    {
      title: "Game Context",
      focus: "Schedule frame, matchup storyline, and pace expectation",
      animationType: "none",
      agentType: "basketball_overview",
      contextMode: "independent",
    },
    {
      title: "Efficiency Profile",
      focus: "Pace, ratings, rebounding, and turnover structure comparison",
      animationType: "basketball_metrics",
      agentType: "basketball_stats",
      contextMode: "build_upon",
    },
    {
      title: "Matchup Tactics",
      focus: "Half-court spacing, transition windows, and rotation targeting",
      animationType: "basketball_matchup",
      agentType: "basketball_tactical",
      contextMode: "build_upon",
    },
    {
      title: "Final Projection",
      focus: "Integrated projection with key scenario risks",
      animationType: "none",
      agentType: "basketball_prediction",
      contextMode: "all",
    },
  ],
};
