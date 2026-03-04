import { AgentConfig } from '../../types';
import { buildAnalysisPrompt } from '../../utils';

const rolePrompts = {
  en: 'You are a risk officer. Build a scenario map with catalysts, downside triggers, and invalidation checkpoints. Quantify severity and timing where possible.',
  zh: '你是一名风险官。请构建情景风险图谱：催化剂、下行触发器与失效条件，并尽量量化严重度与时间窗口。',
};

export const stocksRiskAgent: AgentConfig = {
  id: 'stocks_risk',
  name: 'Stocks Risk Analyst',
  description: 'Maps event risk, failure modes, and scenario probabilities for the asset.',
  skills: [],
  contextDependencies: 'all',
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
