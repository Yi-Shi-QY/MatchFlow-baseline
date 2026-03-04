import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Feng Shui signal analyst. Evaluate qi structure, pressure points, and circulation quality with explicit evidence from provided source data.",
  zh: "你是一名风水信号分析师。请基于给定数据评估气场结构、煞压点与流通质量，并给出明确证据。",
};

export const fengshuiAnalysisAgent: AgentConfig = {
  id: "fengshui_analysis",
  name: "Feng Shui Signal Analyst",
  description: "Evaluates qi structure, pressure, and circulation signals.",
  skills: [],
  contextDependencies: ["fengshui_overview"],
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
