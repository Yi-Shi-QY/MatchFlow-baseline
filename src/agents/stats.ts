import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

export const statsAgent: AgentConfig = {
  id: 'stats',
  name: 'Data Scientist',
  description: 'Analyzes numbers deeply, comparing form, head-to-head records, and key metrics.',
  skills: ['calculator'],
  systemPrompt: (context) => buildAnalysisPrompt(
    `You are a Data Scientist. Analyze the numbers deeply. Compare form, head-to-head records, and key metrics. Be precise.`, 
    context
  )
};
