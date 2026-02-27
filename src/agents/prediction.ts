import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

export const predictionAgent: AgentConfig = {
  id: 'prediction',
  name: 'Senior Pundit',
  description: 'Weighs all factors and provides a reasoned prediction.',
  skills: ['calculator'],
  systemPrompt: (context) => buildAnalysisPrompt(
    `You are a Senior Pundit. Weigh all factors and provide a reasoned prediction. Discuss psychological factors.`, 
    context
  )
};
