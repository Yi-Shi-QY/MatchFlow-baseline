import { PlanTemplate } from '../../types';

export const stocksStandardTemplate: PlanTemplate = {
  id: 'stocks_standard',
  version: '1.0.0',
  name: 'Stocks Standard Template',
  description: 'Balanced flow with overview, technical/fundamental read, and final decision.',
  rule: 'Use as default when either price-action or valuation signal is available.',
  requiredAgents: [
    'stocks_overview',
    'stocks_technical',
    'stocks_fundamental',
    'stocks_prediction',
  ],
  requiredSkills: ['calculator'],
  getSegments: (isZh: boolean) => [
    {
      title: isZh ? '标的概览' : 'Asset Overview',
      focus: isZh ? '背景、阶段与对标关系' : 'Context, market phase, and benchmark relation',
      animationType: 'none',
      agentType: 'stocks_overview',
      contextMode: 'independent',
      sourceIds: ['asset_profile'],
    },
    {
      title: isZh ? '价格结构' : 'Price Structure',
      focus: isZh ? '动量、波动与关键位' : 'Momentum, volatility, and key levels',
      animationType: 'stats',
      agentType: 'stocks_technical',
      contextMode: 'build_upon',
      sourceIds: ['price_action'],
    },
    {
      title: isZh ? '估值健康度' : 'Valuation Health',
      focus: isZh ? '估值、增长质量与修正压力' : 'Valuation, quality of growth, and revision pressure',
      animationType: 'comparison',
      agentType: 'stocks_fundamental',
      contextMode: 'build_upon',
      sourceIds: ['valuation_health'],
    },
    {
      title: isZh ? '结论与建议' : 'Final Recommendation',
      focus: isZh ? '方向判断、仓位建议与风控点' : 'Directional stance, sizing, and risk controls',
      animationType: 'none',
      agentType: 'stocks_prediction',
      contextMode: 'all',
      sourceIds: ['asset_profile', 'price_action', 'valuation_health', 'risk_events'],
    },
  ],
};
