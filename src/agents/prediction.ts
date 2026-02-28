import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

const rolePrompts = {
  en: `You are a Senior Pundit. Weigh all factors and provide a reasoned prediction. Discuss psychological factors.`,
  zh: `你是一位资深评论员。权衡所有因素并提供合理的预测。讨论心理因素。`
};

export const predictionAgent: AgentConfig = {
  id: 'prediction',
  name: 'Senior Pundit',
  description: 'Weighs all factors and provides a reasoned prediction.',
  skills: ['calculator', 'get_animation_template'],
  contextDependencies: 'all',
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  }
};
