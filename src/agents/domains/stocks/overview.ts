import { AgentConfig } from '../../types';
import { buildAnalysisPrompt } from '../../utils';

const rolePrompts = {
  en: 'You are a senior equity strategist. Build a concise setup overview: market regime, asset context, benchmark relation, and decision frame.',
  zh: '你是一名资深股票策略师。请先给出简明的标的概览：市场阶段、资产背景、相对基准位置与决策框架。',
};

export const stocksOverviewAgent: AgentConfig = {
  id: 'stocks_overview',
  name: 'Stocks Overview Strategist',
  description: 'Summarizes setup, market regime, and benchmark context for the target asset.',
  skills: [],
  contextDependencies: 'none',
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
