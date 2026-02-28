import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

export const generalAgent: AgentConfig = {
  id: 'general',
  name: 'Senior Football Analyst',
  description: 'General football analysis.',
  skills: [],
  contextDependencies: 'all',
  systemPrompt: (context) => buildAnalysisPrompt(
    `You are a Senior Football Analyst.`, 
    context
  )
};
