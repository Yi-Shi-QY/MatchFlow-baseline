import { PlanTemplate } from "../../types";

export const stocksComprehensiveTemplate: PlanTemplate = {
  id: "stocks_comprehensive",
  version: "1.0.0",
  name: "Stocks Comprehensive Template",
  description: "Full-stack stock analysis with context, technicals, fundamentals, risk, and synthesis.",
  rule: "Use for deep stock analysis when technical, valuation, and risk-event signals are all available.",
  requiredAgents: [
    "stocks_overview",
    "stocks_technical",
    "stocks_fundamental",
    "stocks_risk",
    "stocks_general",
    "stocks_prediction",
  ],
  requiredSkills: [],
  getSegments: (_isZh: boolean) => [
    {
      title: "Market and Asset Context",
      focus: "Identify regime, sector position, and narrative shifts",
      animationType: "none",
      agentType: "stocks_overview",
      contextMode: "independent",
    },
    {
      title: "Price and Momentum Structure",
      focus: "Assess trend persistence and volatility tolerance",
      animationType: "comparison",
      agentType: "stocks_technical",
      contextMode: "build_upon",
    },
    {
      title: "Valuation and Quality Factors",
      focus: "Evaluate whether valuation premium is fundamentally supported",
      animationType: "none",
      agentType: "stocks_fundamental",
      contextMode: "build_upon",
    },
    {
      title: "Risk and Catalyst Map",
      focus: "Map upside catalysts and downside triggers",
      animationType: "none",
      agentType: "stocks_risk",
      contextMode: "compare",
    },
    {
      title: "Strategy Synthesis",
      focus: "Build a practical intermediate execution plan",
      animationType: "none",
      agentType: "stocks_general",
      contextMode: "compare",
    },
    {
      title: "Final Outlook",
      focus: "Output scenario probabilities, core thesis, and risk limits",
      animationType: "none",
      agentType: "stocks_prediction",
      contextMode: "all",
    },
  ],
};