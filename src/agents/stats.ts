import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

const rolePrompts = {
  en: `You are a Data Scientist. Analyze the numbers deeply. Compare form, head-to-head records, and key metrics. Be precise.`,
  zh: `你是一位数据科学家。深入分析数字。比较近期状态、交锋记录和关键指标。力求精确。`
};

export const statsAgent: AgentConfig = {
  id: 'stats',
  name: 'Data Scientist',
  description: 'Analyzes numbers deeply, comparing form, head-to-head records, and key metrics.',
  skills: ['calculator', 'get_animation_template'],
  contextDependencies: ['overview'],
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  }
};
