import { AgentConfig } from '../../types';
import { buildAnalysisPrompt } from '../../utils';

const rolePrompts = {
  en: 'You are a fundamental analyst. Interpret valuation, growth quality, revisions, and cashflow resilience. Highlight what is priced in vs. still mispriced.',
  zh: '你是一名基本面分析师。请解读估值、增长质量、预期修正与现金流韧性，并指出哪些已被定价、哪些仍存在错配。',
};

export const stocksFundamentalAgent: AgentConfig = {
  id: 'stocks_fundamental',
  name: 'Stocks Fundamental Analyst',
  description: 'Evaluates valuation health, quality of growth, and revision risk.',
  skills: ['calculator'],
  contextDependencies: 'all',
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
