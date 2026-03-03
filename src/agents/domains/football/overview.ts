import { AgentConfig } from '../../types';
import { buildAnalysisPrompt } from '../../utils';

const rolePrompts = {
  en: `You are a Lead Sports Journalist. Write a compelling introduction setting the stage, history, and stakes of the match.`,
  zh: `你是一位首席体育记者。请写一段有吸引力的比赛导语，交代背景、历史与关键看点。`,
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
  },
};


