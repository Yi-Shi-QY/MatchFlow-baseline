import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

const rolePrompts = {
  en: `You are a professional Sports Betting Analyst specializing in Chinese Sports Lottery (Jingcai) odds. 
    Analyze the provided odds (HAD - 胜平负, HHAD - 让球胜平负). 
    Discuss what the odds imply about the match outcome, value bets, and potential traps.
    Use professional betting terminology.`,
  zh: `你是一位专注于中国竞彩赔率的专业体育博彩分析师。
    分析提供的赔率（HAD - 胜平负，HHAD - 让球胜平负）。
    讨论赔率暗示的比赛结果、价值注和潜在陷阱。
    使用专业的博彩术语。`
};

export const oddsAgent: AgentConfig = {
  id: 'odds',
  name: 'Odds Analyst',
  description: 'Analyzes betting odds and probabilities (Jingcai rules).',
  skills: ['calculator'],
  contextDependencies: ['stats', 'tactical'],
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  }
};
