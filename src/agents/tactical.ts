import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

export const tacticalAgent: AgentConfig = {
  id: 'tactical',
  name: 'Tactical Analyst',
  description: 'Breaks down formations, key battles, and strategic approaches.',
  skills: [],
  systemPrompt: (context) => buildAnalysisPrompt(
    `You are a Tactical Analyst (like Gary Neville). Break down the formations, key battles, and strategic approaches. Use technical terms.`, 
    context
  )
};
