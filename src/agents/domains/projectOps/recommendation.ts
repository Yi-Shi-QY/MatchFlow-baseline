import { buildAnalysisPrompt } from '../../utils';
import type { AgentConfig } from '../../types';

const rolePrompts = {
  en: 'You are a chief of staff for operations. Turn the evidence into a concrete recommendation with owner, timing, and escalation guidance.',
  zh: 'You are a chief of staff for operations. Turn the evidence into a concrete recommendation with owner, timing, and escalation guidance.',
};

export const projectOpsRecommendationAgent: AgentConfig = {
  id: 'project_ops_recommendation',
  name: 'Project Ops Recommendation',
  description: 'Produces the recommended next step, owner, and timing call.',
  skills: [],
  contextDependencies: ['project_ops_overview', 'project_ops_risk'],
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
