import type { AgentConfig } from "../../types";
import { generalAgent } from "./general";
import { oddsAgent } from "./odds";
import { overviewAgent } from "./overview";
import { footballPlannerAutonomousAgent } from "./planner_autonomous";
import { footballPlannerTemplateAgent } from "./planner_template";
import { predictionAgent } from "./prediction";
import { statsAgent } from "./stats";
import { tacticalAgent } from "./tactical";

export { overviewAgent } from "./overview";
export { statsAgent } from "./stats";
export { tacticalAgent } from "./tactical";
export { oddsAgent } from "./odds";
export { predictionAgent } from "./prediction";
export { generalAgent } from "./general";
export { footballPlannerTemplateAgent } from "./planner_template";
export { footballPlannerAutonomousAgent } from "./planner_autonomous";

export const DOMAIN_AGENT_ENTRIES: Record<string, AgentConfig> = {
  overview: overviewAgent,
  stats: statsAgent,
  tactical: tacticalAgent,
  prediction: predictionAgent,
  general: generalAgent,
  football_planner_template: footballPlannerTemplateAgent,
  football_planner_autonomous: footballPlannerAutonomousAgent,
  odds: oddsAgent,
};

export const DOMAIN_AGENT_VERSION_ENTRIES: Record<string, string> = {
  overview: "1.0.0",
  stats: "1.0.0",
  tactical: "1.0.0",
  prediction: "1.0.0",
  general: "1.0.0",
  football_planner_template: "1.0.0",
  football_planner_autonomous: "1.0.0",
  odds: "1.0.0",
};
