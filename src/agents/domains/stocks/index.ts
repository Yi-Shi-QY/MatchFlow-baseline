import type { AgentConfig } from '../../types';
import { stocksFundamentalAgent } from './fundamental';
import { stocksGeneralAgent } from './general';
import { stocksOverviewAgent } from './overview';
import { stocksPlannerAutonomousAgent } from './planner_autonomous';
import { stocksPlannerTemplateAgent } from './planner_template';
import { stocksPredictionAgent } from './prediction';
import { stocksRiskAgent } from './risk';
import { stocksTechnicalAgent } from './technical';

export { stocksOverviewAgent } from './overview';
export { stocksTechnicalAgent } from './technical';
export { stocksFundamentalAgent } from './fundamental';
export { stocksRiskAgent } from './risk';
export { stocksPredictionAgent } from './prediction';
export { stocksGeneralAgent } from './general';
export { stocksPlannerTemplateAgent } from './planner_template';
export { stocksPlannerAutonomousAgent } from './planner_autonomous';

export const DOMAIN_AGENT_ENTRIES: Record<string, AgentConfig> = {
  stocks_overview: stocksOverviewAgent,
  stocks_technical: stocksTechnicalAgent,
  stocks_fundamental: stocksFundamentalAgent,
  stocks_risk: stocksRiskAgent,
  stocks_prediction: stocksPredictionAgent,
  stocks_general: stocksGeneralAgent,
  stocks_planner_template: stocksPlannerTemplateAgent,
  stocks_planner_autonomous: stocksPlannerAutonomousAgent,
};

export const DOMAIN_AGENT_VERSION_ENTRIES: Record<string, string> = {
  stocks_overview: '1.0.0',
  stocks_technical: '1.0.0',
  stocks_fundamental: '1.0.0',
  stocks_risk: '1.0.0',
  stocks_prediction: '1.0.0',
  stocks_general: '1.0.0',
  stocks_planner_template: '1.0.0',
  stocks_planner_autonomous: '1.0.0',
};
