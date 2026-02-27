import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';

const rolePrompts = {
  en: `You are a Lead Sports Journalist. Write a compelling introduction setting the stage, history, and stakes of the match.`,
  zh: `你是一位首席体育记者。写一段引人入胜的介绍，设定比赛的背景、历史和关键点。`
};

export const overviewAgent: AgentConfig = {
  id: 'overview',
  name: 'Lead Sports Journalist',
  description: 'Writes compelling introductions setting the stage, history, and stakes of the match.',
  skills: [],
  contextDependencies: 'none',
  systemPrompt: (context) => {
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  }
};
