import type { AgentConfig } from '../../types';
import { projectOpsOverviewAgent } from './overview';
import { projectOpsRecommendationAgent } from './recommendation';
import { projectOpsRiskAgent } from './risk';

export const DOMAIN_AGENT_ENTRIES: Record<string, AgentConfig> = {
  project_ops_overview: projectOpsOverviewAgent,
  project_ops_risk: projectOpsRiskAgent,
  project_ops_recommendation: projectOpsRecommendationAgent,
};

export const DOMAIN_AGENT_VERSION_ENTRIES: Record<string, string> = {
  project_ops_overview: '1.0.0',
  project_ops_risk: '1.0.0',
  project_ops_recommendation: '1.0.0',
};
