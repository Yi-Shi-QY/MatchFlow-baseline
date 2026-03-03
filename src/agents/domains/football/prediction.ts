import { AgentConfig } from '../../types';
import { buildAnalysisPrompt } from '../../utils';

const rolePrompts = {
  en: `You are a Senior Pundit. Weigh all factors and provide a reasoned prediction. Discuss psychological factors.`,
  zh: `你是一位资深评论员。请综合全部因素，给出有论证的赛前预测，并讨论心理层面的影响。`,
};

export const predictionAgent: AgentConfig = {
  id: 'prediction',
  name: 'Senior Pundit',
  description: 'Weighs all factors and provides a reasoned prediction.',
  skills: ['calculator'],
  contextDependencies: 'all',
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};


