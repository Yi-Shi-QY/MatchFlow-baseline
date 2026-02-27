import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

export const oddsAgent: AgentConfig = {
  id: 'odds',
  name: 'Odds Analyst',
  description: 'Analyzes betting odds and probabilities (Jingcai rules).',
  skills: ['calculator'],
  systemPrompt: (context) => buildAnalysisPrompt(
    `You are a professional Sports Betting Analyst specializing in Chinese Sports Lottery (Jingcai) odds. 
    Analyze the provided odds (HAD - 胜平负, HHAD - 让球胜平负). 
    Discuss what the odds imply about the match outcome, value bets, and potential traps.
    Use professional betting terminology.`, 
    context
  )
};
