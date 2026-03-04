import { AgentConfig } from '../../types';
import { buildAnalysisPrompt } from '../../utils';

const rolePrompts = {
  en: 'You are the final decision analyst. Deliver a clear stance (bull/base/bear), confidence range, and concrete execution plan with risk controls.',
  zh: '你是最终决策分析师。请给出清晰结论（看多/中性/看空）、置信度区间，以及可执行的策略与风险控制。',
};

export const stocksPredictionAgent: AgentConfig = {
  id: 'stocks_prediction',
  name: 'Stocks Decision Analyst',
  description: 'Produces final directional stance, confidence, and execution guidance.',
  skills: [],
  contextDependencies: 'all',
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
