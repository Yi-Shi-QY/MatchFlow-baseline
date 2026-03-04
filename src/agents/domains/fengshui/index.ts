import type { AgentConfig } from "../../types";
import { fengshuiOverviewAgent } from "./overview";
import { fengshuiAnalysisAgent } from "./analysis";
import { fengshuiPredictionAgent } from "./prediction";
import { fengshuiGeneralAgent } from "./general";
import { fengshuiPlannerTemplateAgent } from "./planner_template";
import { fengshuiPlannerAutonomousAgent } from "./planner_autonomous";

export { fengshuiOverviewAgent } from "./overview";
export { fengshuiAnalysisAgent } from "./analysis";
export { fengshuiPredictionAgent } from "./prediction";
export { fengshuiGeneralAgent } from "./general";
export { fengshuiPlannerTemplateAgent } from "./planner_template";
export { fengshuiPlannerAutonomousAgent } from "./planner_autonomous";

export const DOMAIN_AGENT_ENTRIES: Record<string, AgentConfig> = {
  fengshui_overview: fengshuiOverviewAgent,
  fengshui_analysis: fengshuiAnalysisAgent,
  fengshui_prediction: fengshuiPredictionAgent,
  fengshui_general: fengshuiGeneralAgent,
  fengshui_planner_template: fengshuiPlannerTemplateAgent,
  fengshui_planner_autonomous: fengshuiPlannerAutonomousAgent,
};

export const DOMAIN_AGENT_VERSION_ENTRIES: Record<string, string> = {
  fengshui_overview: "1.0.0",
  fengshui_analysis: "1.0.0",
  fengshui_prediction: "1.0.0",
  fengshui_general: "1.0.0",
  fengshui_planner_template: "1.0.0",
  fengshui_planner_autonomous: "1.0.0",
};
