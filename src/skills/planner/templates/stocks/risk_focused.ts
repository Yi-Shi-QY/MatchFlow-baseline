import { PlanTemplate } from "../../types";

export const stocksRiskFocusedTemplate: PlanTemplate = {
  id: "stocks_risk_focused",
  version: "1.0.0",
  name: "Stocks Risk Focused Template",
  description: "Event and risk-focused stock analysis for uncertain environments.",
  rule: "Use when event-driven risk signals dominate and technical/fundamental inputs are limited.",
  requiredAgents: ["stocks_overview", "stocks_risk", "stocks_prediction"],
  requiredSkills: [],
  getSegments: (_isZh: boolean) => [
    {
      title: "Risk Context",
      focus: "Define current regime and dominant risk narrative",
      animationType: "none",
      agentType: "stocks_overview",
      contextMode: "independent",
    },
    {
      title: "Event Radar",
      focus: "Map catalysts and downside triggers",
      animationType: "none",
      agentType: "stocks_risk",
      contextMode: "build_upon",
    },
    {
      title: "Defensive Plan",
      focus: "Provide risk-control boundaries and execution guidance",
      animationType: "none",
      agentType: "stocks_prediction",
      contextMode: "all",
    },
  ],
};