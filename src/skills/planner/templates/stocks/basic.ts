import { PlanTemplate } from '../../types';

export const stocksBasicTemplate: PlanTemplate = {
  id: 'stocks_basic',
  version: '1.0.0',
  name: 'Stocks Basic Template',
  description: 'Quick overview + final stance.',
  rule: 'Use when data is minimal or user asks for a concise recommendation.',
  requiredAgents: ['stocks_overview', 'stocks_prediction'],
  requiredSkills: [],
  getSegments: (isZh: boolean) => [
    {
      title: isZh ? '标的概览' : 'Asset Overview',
      focus: isZh ? '核心背景与关键驱动' : 'Core setup and key drivers',
      animationType: 'none',
      agentType: 'stocks_overview',
      contextMode: 'independent',
      sourceIds: ['asset_profile'],
    },
    {
      title: isZh ? '结论与建议' : 'Final Recommendation',
      focus: isZh ? '方向判断与执行建议' : 'Directional stance and execution guidance',
      animationType: 'none',
      agentType: 'stocks_prediction',
      contextMode: 'all',
      sourceIds: ['asset_profile', 'price_action', 'valuation_health', 'risk_events'],
    },
  ],
};
