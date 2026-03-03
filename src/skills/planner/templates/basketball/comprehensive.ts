import { PlanTemplate } from "../../types";

export const basketballComprehensiveTemplate: PlanTemplate = {
  id: "basketball_comprehensive",
  version: "1.0.0",
  name: "Basketball Comprehensive Template",
  description:
    "Full-stack basketball analysis covering context, metrics, tactical matchups, market, and projection.",
  rule: "Use for deep basketball analysis when both performance matrix and market lines are available.",
  requiredAgents: [
    "basketball_overview",
    "basketball_stats",
    "basketball_tactical",
    "basketball_market",
    "basketball_general",
    "basketball_prediction",
  ],
  requiredSkills: [],
  getSegments: (_isZh: boolean) => [
    {
      title: "Game Context",
      focus: "Storyline, schedule pressure, and matchup anchor points",
      animationType: "none",
      agentType: "basketball_overview",
      contextMode: "independent",
    },
    {
      title: "Efficiency Profile",
      focus: "Structured comparison of pace, ratings, rebounding, and turnovers",
      animationType: "basketball_metrics",
      agentType: "basketball_stats",
      contextMode: "build_upon",
    },
    {
      title: "Matchup Tactics",
      focus: "Targeted matchups, half-court spacing, and rotation adjustments",
      animationType: "basketball_matchup",
      agentType: "basketball_tactical",
      contextMode: "build_upon",
    },
    {
      title: "Lines Interpretation",
      focus: "Integrated reading of moneyline, spread, and total signals",
      animationType: "basketball_lines",
      agentType: "basketball_market",
      contextMode: "build_upon",
    },
    {
      title: "Scenario Risk Control",
      focus: "Use situational clues to evaluate volatility and downside scenarios",
      animationType: "none",
      agentType: "basketball_general",
      contextMode: "compare",
    },
    {
      title: "Final Projection",
      focus: "Deliver executable conclusion with key risk warnings",
      animationType: "none",
      agentType: "basketball_prediction",
      contextMode: "all",
    },
  ],
};
