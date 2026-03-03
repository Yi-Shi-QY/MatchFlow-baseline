import { PlanTemplate } from "../../types";

export const basketballLinesFocusedTemplate: PlanTemplate = {
  id: "basketball_lines_focused",
  version: "1.0.0",
  name: "Basketball Lines Focused Template",
  description: "Basketball market-focused plan around moneyline, spread, and totals.",
  rule: "Use when line data is the core signal or the user explicitly asks for market interpretation.",
  requiredAgents: [
    "basketball_overview",
    "basketball_stats",
    "basketball_market",
    "basketball_prediction",
  ],
  requiredSkills: [],
  getSegments: (_isZh: boolean) => [
    {
      title: "Game Context",
      focus: "Game narrative and market pricing context",
      animationType: "none",
      agentType: "basketball_overview",
      contextMode: "independent",
    },
    {
      title: "Metrics Snapshot",
      focus: "Whether efficiency and pace support line direction",
      animationType: "basketball_metrics",
      agentType: "basketball_stats",
      contextMode: "build_upon",
    },
    {
      title: "Lines Structure",
      focus: "Interpret moneyline, spread, and total points structure",
      animationType: "basketball_lines",
      agentType: "basketball_market",
      contextMode: "independent",
    },
    {
      title: "Market Imbalance",
      focus: "Detect consensus positioning and asymmetric pricing risk",
      animationType: "basketball_lines",
      agentType: "basketball_market",
      contextMode: "compare",
    },
    {
      title: "Final Projection",
      focus: "Final call with risk-control notes",
      animationType: "none",
      agentType: "basketball_prediction",
      contextMode: "all",
    },
  ],
};
