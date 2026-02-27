import { overviewAgent } from './overview';
import { statsAgent } from './stats';
import { tacticalAgent } from './tactical';
import { predictionAgent } from './prediction';
import { generalAgent } from './general';
import { plannerAgent } from './planner';
import { tagAgent } from './tag';
import { summaryAgent } from './summary';
import { AgentConfig } from './types';

export const agents: Record<string, AgentConfig> = {
  overview: overviewAgent,
  stats: statsAgent,
  tactical: tacticalAgent,
  prediction: predictionAgent,
  general: generalAgent,
  planner: plannerAgent,
  tag: tagAgent,
  summary: summaryAgent
};

export function getAgent(id: string): AgentConfig {
  return agents[id] || agents['general'];
}

export * from './types';
