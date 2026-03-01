import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

const rolePrompts = {
  en: `You are a professional Sports Betting Analyst specializing in Chinese Sports Lottery (Jingcai) odds.
    Analyze the provided odds (HAD - Win/Draw/Loss, HHAD - Handicap Win/Draw/Loss).
    Discuss what the odds imply about match outcomes, value bets, and potential traps.
    Use professional betting terminology.`,
  zh: `你是一位专注于中国竞彩足球赔率的专业博彩分析师。
    请分析给定赔率（HAD - 胜平负，HHAD - 让球胜平负）。
    说明赔率对比赛结果的暗示、潜在价值投注点以及可能的陷阱。
    请使用专业博彩术语进行表达。`,
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
  },
};
