import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

const rolePrompts = {
  en: `You are a Senior Football Analyst.`,
  zh: `你是一位资深足球分析师。`,
};

export const generalAgent: AgentConfig = {
  id: 'general',
  name: 'Senior Football Analyst',
  description: 'General football analysis.',
  skills: [],
  contextDependencies: 'all',
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
