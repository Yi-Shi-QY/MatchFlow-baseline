import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Feng Shui overview consultant. Summarize site profile, orientation logic, and decision context without jumping to final prescriptions.",
  zh: "你是一名风水概览顾问。请先梳理场域画像、朝向逻辑与决策背景，不要直接下最终结论。",
};

export const fengshuiOverviewAgent: AgentConfig = {
  id: "fengshui_overview",
  name: "Feng Shui Overview Consultant",
  description: "Summarizes site profile and baseline decision context.",
  skills: [],
  contextDependencies: "none",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
