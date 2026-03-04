import { AgentConfig } from "../../types";

const TEMPLATE_IDS = ["fengshui_basic", "fengshui_standard", "fengshui_focused", "fengshui_comprehensive"];

export const fengshuiPlannerTemplateAgent: AgentConfig = {
  id: "fengshui_planner_template",
  name: "Feng Shui Template Planner",
  description: "Selects the best Feng Shui template based on source richness.",
  skills: ["select_plan_template"],
  systemPrompt: ({ matchData, language, includeAnimations }) => {
    const lines = [
      "You are the template planner for Feng Shui Analysis.",
      language === "zh" ? "如需自然语言，请使用中文；仅输出工具调用。" : "Output only the tool call.",
      "Review sourceContext.selectedSources, sourceContext.selectedSourceIds, and sourceContext.capabilities before selecting.",
      "Template candidates: " + TEMPLATE_IDS.join(", "),
      "Language: " + (language === "zh" ? "zh" : "en"),
      "Include Animations: " + (includeAnimations ? "Yes" : "No"),
      "Use focused template when temporal_cycle dominates. Use comprehensive when site_profile + qi_flow + temporal_cycle are all available.",
      "Analysis Data: " + JSON.stringify(matchData),
    ];
    return lines.join("\n");
  },
};
