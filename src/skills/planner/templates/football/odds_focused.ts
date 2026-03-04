import { PlanTemplate } from '../../types';

export const oddsFocusedTemplate: PlanTemplate = {
  id: 'odds_focused',
  version: '1.0.0',
  name: 'Odds Focused Template',
  description: 'Focuses heavily on betting odds (Asian Handicap, European Odds).',
  rule: 'Use when the user explicitly asks for betting advice, odds analysis, or when odds data is the primary focus.',
  requiredAgents: ['overview', 'stats', 'odds', 'prediction'],
  requiredSkills: [],
  getSegments: (isZh: boolean) => [
    {
      title: isZh ? '比赛概览' : 'Match Overview',
      focus: isZh ? '背景与关键看点' : 'Context and stakes',
      animationType: 'none',
      agentType: 'overview',
      contextMode: 'independent',
      sourceIds: ['fundamental'],
    },
    {
      title: isZh ? '近期状态' : 'Recent Form',
      focus: isZh ? '对比最近 5 场表现' : 'Compare last 5 games',
      animationType: 'stats',
      agentType: 'stats',
      contextMode: 'build_upon',
      sourceIds: ['fundamental'],
    },
    {
      title: isZh ? '亚盘分析' : 'Asian Handicap',
      focus: isZh ? '亚洲让球盘口分析' : 'Asian market analysis',
      animationType: 'odds',
      agentType: 'odds',
      contextMode: 'independent',
      sourceIds: ['market'],
    },
    {
      title: isZh ? '欧赔分析' : 'European Odds',
      focus: isZh ? '欧洲赔率对比' : 'Euro market comparison',
      animationType: 'odds',
      agentType: 'odds',
      contextMode: 'compare',
      sourceIds: ['market'],
    },
    {
      title: isZh ? '赛前预测' : 'Match Prediction',
      focus: isZh ? '最终预测与结论' : 'Final prediction and conclusion',
      animationType: 'none',
      agentType: 'prediction',
      contextMode: 'all',
      sourceIds: ['fundamental', 'market', 'custom'],
    },
  ],
};


