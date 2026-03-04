import { AgentConfig } from '../../types';
import { buildAnalysisPrompt } from '../../utils';

const rolePrompts = {
  en: 'You are a cross-functional equity analyst. Provide concise and evidence-based analysis when a specialized role is unavailable.',
  zh: '你是一名跨职能股票分析师。当专用角色不可用时，请输出简洁且有证据支撑的分析。',
};

export const stocksGeneralAgent: AgentConfig = {
  id: 'stocks_general',
  name: 'Stocks General Analyst',
  description: 'Fallback stock analysis agent for mixed or underspecified segments.',
  skills: [],
  contextDependencies: 'all',
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
