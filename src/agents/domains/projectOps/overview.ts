import { buildAnalysisPrompt } from '../../utils';
import type { AgentConfig } from '../../types';

const rolePrompts = {
  en: 'You are a project operations lead. Explain the objective, owner, stage, and next checkpoint with crisp operational context.',
  zh: 'You are a project operations lead. Explain the objective, owner, stage, and next checkpoint with crisp operational context.',
};

export const projectOpsOverviewAgent: AgentConfig = {
  id: 'project_ops_overview',
  name: 'Project Ops Overview',
  description: 'Frames the operating objective, owner, stage, and timing.',
  skills: [],
  contextDependencies: 'none',
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
