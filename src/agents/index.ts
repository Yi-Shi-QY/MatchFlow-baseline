import { overviewAgent } from './overview';
import { statsAgent } from './stats';
import { tacticalAgent } from './tactical';
import { predictionAgent } from './prediction';
import { generalAgent } from './general';
import { plannerTemplateAgent } from './planner_template';
import { plannerAutonomousAgent } from './planner_autonomous';
import { tagAgent } from './tag';
import { summaryAgent } from './summary';
import { oddsAgent } from './odds';
import { AgentConfig } from './types';

export const agents: Record<string, AgentConfig> = {
  overview: overviewAgent,
  stats: statsAgent,
  tactical: tacticalAgent,
  prediction: predictionAgent,
  general: generalAgent,
  planner_template: plannerTemplateAgent,
  planner_autonomous: plannerAutonomousAgent,
  tag: tagAgent,
  summary: summaryAgent,
  odds: oddsAgent
};

export function getAgent(id: string): AgentConfig {
  return agents[id] || agents['general'];
}

export * from './types';
