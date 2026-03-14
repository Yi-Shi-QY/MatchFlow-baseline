import { buildAnalysisPrompt } from '../../utils';
import type { AgentConfig } from '../../types';

const rolePrompts = {
  en: 'You are a delivery risk analyst. Surface blockers, dependency risk, timeline pressure, and execution uncertainty.',
  zh: 'You are a delivery risk analyst. Surface blockers, dependency risk, timeline pressure, and execution uncertainty.',
};

export const projectOpsRiskAgent: AgentConfig = {
  id: 'project_ops_risk',
  name: 'Project Ops Risk Analyst',
  description: 'Identifies blockers, dependency pressure, and operating risk.',
  skills: [],
  contextDependencies: ['project_ops_overview'],
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
