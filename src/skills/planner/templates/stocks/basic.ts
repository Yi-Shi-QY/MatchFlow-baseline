import { PlanTemplate } from "../../types";

export const stocksBasicTemplate: PlanTemplate = {
  id: "stocks_basic",
  version: "1.0.0",
  name: "Stocks Basic Template",
  description: "Quick stock brief with market context and final outlook.",
  rule: "Use when only lightweight stock data is available or user wants a concise conclusion.",
  requiredAgents: ["stocks_overview", "stocks_prediction"],
  requiredSkills: [],
  getSegments: (_isZh: boolean) => [
    {
      title: "Asset Context",
      focus: "Market regime, narrative, and context anchors",
      animationType: "none",
      agentType: "stocks_overview",
      contextMode: "independent",
    },
    {
      title: "Final Outlook",
      focus: "Scenario-weighted outlook with execution caveats",
      animationType: "none",
      agentType: "stocks_prediction",
      contextMode: "all",
    },
  ],
};