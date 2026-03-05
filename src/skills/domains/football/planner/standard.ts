import { PlanTemplate } from '../../planner/types';

export const standardTemplate: PlanTemplate = {
  id: 'standard',
  version: '1.0.0',
  name: 'Standard Template',
  description: 'Includes overview, stats, tactical battle, and prediction.',
  rule: 'Use by default for a balanced analysis when standard match data is available.',
  requiredAgents: ['overview', 'stats', 'tactical', 'prediction'],
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
      title: isZh ? '战术对决' : 'Tactical Battle',
      focus: isZh ? '阵型与关键对位' : 'Formations and key matchups',
      animationType: 'tactical',
      agentType: 'tactical',
      contextMode: 'build_upon',
      sourceIds: ['fundamental'],
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



