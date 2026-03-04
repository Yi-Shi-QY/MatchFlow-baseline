import { AgentConfig } from '../../types';
import { buildAnalysisPrompt } from '../../utils';

const rolePrompts = {
  en: 'You are a technical and flow analyst. Evaluate momentum, volatility, support/resistance, and whether price structure confirms the thesis.',
  zh: '你是一名技术面与交易流分析师。请评估动量、波动、支撑阻力，以及价格结构是否支持当前假设。',
};

export const stocksTechnicalAgent: AgentConfig = {
  id: 'stocks_technical',
  name: 'Stocks Technical Analyst',
  description: 'Analyzes trend strength, volatility regime, and key technical levels.',
  skills: [],
  contextDependencies: 'all',
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
