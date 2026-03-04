import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "You are a Feng Shui integration analyst. Connect timing windows with practical constraints, and highlight sequencing trade-offs.",
  zh: "你是一名风水整合分析师。请把时运窗口与实际约束结合起来，并指出执行顺序上的取舍。",
};

export const fengshuiGeneralAgent: AgentConfig = {
  id: "fengshui_general",
  name: "Feng Shui Integration Analyst",
  description: "Integrates timing windows with practical constraints.",
  skills: [],
  contextDependencies: ["fengshui_overview", "fengshui_analysis"],
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
