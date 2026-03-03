import { PlanTemplate } from '../../types';

export const comprehensiveTemplate: PlanTemplate = {
  id: 'comprehensive',
  version: '1.0.0',
  name: 'Comprehensive Template',
  description: 'All segments including overview, stats, tactical, odds, and prediction.',
  rule: 'Use when the user wants a deep, detailed, and complete analysis covering all aspects of the match.',
  requiredAgents: ['overview', 'stats', 'tactical', 'odds', 'prediction'],
  requiredSkills: [],
  getSegments: (isZh: boolean) => [
    {
      title: isZh ? '比赛概览' : 'Match Overview',
      focus: isZh ? '背景与关键看点' : 'Context and stakes',
      animationType: 'none',
      agentType: 'overview',
      contextMode: 'independent',
    },
    {
      title: isZh ? '近期状态' : 'Recent Form',
      focus: isZh ? '对比最近 5 场表现' : 'Compare last 5 games',
      animationType: 'stats',
      agentType: 'stats',
      contextMode: 'build_upon',
    },
    {
      title: isZh ? '战术对决' : 'Tactical Battle',
      focus: isZh ? '阵型与关键对位' : 'Formations and key matchups',
      animationType: 'tactical',
      agentType: 'tactical',
      contextMode: 'build_upon',
    },
    {
      title: isZh ? '赔率分析' : 'Odds Analysis',
      focus: isZh ? '竞彩足球赔率拆解' : 'Jingcai odds breakdown',
      animationType: 'odds',
      agentType: 'odds',
      contextMode: 'build_upon',
    },
    {
      title: isZh ? '赛前预测' : 'Match Prediction',
      focus: isZh ? '最终预测与结论' : 'Final prediction and conclusion',
      animationType: 'none',
      agentType: 'prediction',
      contextMode: 'all',
    },
  ],
};


