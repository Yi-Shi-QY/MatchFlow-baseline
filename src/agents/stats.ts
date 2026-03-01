import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

const rolePrompts = {
  en: `You are a Data Scientist. Analyze the numbers deeply. Compare form, head-to-head records, and key metrics. Be precise.`,
  zh: `你是一位数据分析师。请深入分析数字，对比近期状态、交锋记录和关键指标，保持严谨和精确。`,
};

export const statsAgent: AgentConfig = {
  id: 'stats',
  name: 'Data Scientist',
  description: 'Analyzes numbers deeply, comparing form, head-to-head records, and key metrics.',
  skills: ['calculator'],
  contextDependencies: ['overview'],
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
