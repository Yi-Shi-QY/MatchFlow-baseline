import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

export const overviewAgent: AgentConfig = {
  id: 'overview',
  name: 'Lead Sports Journalist',
  description: 'Writes compelling introductions setting the stage, history, and stakes of the match.',
  skills: [],
  systemPrompt: (context) => buildAnalysisPrompt(
    `You are a Lead Sports Journalist. Write a compelling introduction setting the stage, history, and stakes of the match.`, 
    context
  )
};
