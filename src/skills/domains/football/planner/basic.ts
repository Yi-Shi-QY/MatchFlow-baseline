import { PlanTemplate } from '../../planner/types';

export const basicTemplate: PlanTemplate = {
  id: 'basic',
  version: '1.0.0',
  name: 'Basic Template',
  description: 'Only overview and prediction.',
  rule: 'Use when the user only wants a quick overview or prediction, or when data is very limited.',
  requiredAgents: ['overview', 'prediction'],
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
      title: isZh ? '赛前预测' : 'Match Prediction',
      focus: isZh ? '最终预测与结论' : 'Final prediction and conclusion',
      animationType: 'none',
      agentType: 'prediction',
      contextMode: 'all',
      sourceIds: ['fundamental', 'market', 'custom'],
    },
  ],
};



