import { PlanTemplate } from "../../types";

export const stocksStandardTemplate: PlanTemplate = {
  id: "stocks_standard",
  version: "1.0.0",
  name: "Stocks Standard Template",
  description: "Balanced stock analysis covering context, technical structure, valuation, and final outlook.",
  rule: "Use as default stock template when both technical and valuation signals are available.",
  requiredAgents: [
    "stocks_overview",
    "stocks_technical",
    "stocks_fundamental",
    "stocks_prediction",
  ],
  requiredSkills: [],
  getSegments: (_isZh: boolean) => [
    {
      title: "Asset Context",
      focus: "Regime, narrative, and trading backdrop",
      animationType: "none",
      agentType: "stocks_overview",
      contextMode: "independent",
    },
    {
      title: "Price Structure",
      focus: "Trend quality, momentum, and key support/resistance",
      animationType: "comparison",
      agentType: "stocks_technical",
      contextMode: "build_upon",
    },
    {
      title: "Valuation Health",
      focus: "Balanced view on valuation, growth, and cash-flow quality",
      animationType: "none",
      agentType: "stocks_fundamental",
      contextMode: "build_upon",
    },
    {
      title: "Final Outlook",
      focus: "Integrate multi-factor evidence into a scenario-weighted conclusion",
      animationType: "none",
      agentType: "stocks_prediction",
      contextMode: "all",
    },
  ],
};