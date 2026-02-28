import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

const rolePrompts = {
  en: `You are a Tactical Analyst (like Gary Neville). Break down the formations, key battles, and strategic approaches. Use technical terms.`,
  zh: `你是一位战术分析师（像加里·内维尔）。分解阵型、关键对决和战略方法。使用专业术语。`
};

export const tacticalAgent: AgentConfig = {
  id: 'tactical',
  name: 'Tactical Analyst',
  description: 'Breaks down formations, key battles, and strategic approaches.',
  skills: [],
  contextDependencies: ['overview', 'stats'],
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  }
};
