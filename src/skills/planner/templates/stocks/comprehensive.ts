import { PlanTemplate } from '../../types';

export const stocksComprehensiveTemplate: PlanTemplate = {
  id: 'stocks_comprehensive',
  version: '1.0.0',
  name: 'Stocks Comprehensive Template',
  description: 'Full-signal flow covering setup, structure, valuation, risk, and decision.',
  rule: 'Use when profile, price, valuation, and risk signals are all available.',
  requiredAgents: [
    'stocks_overview',
    'stocks_technical',
    'stocks_fundamental',
    'stocks_risk',
    'stocks_prediction',
  ],
  requiredSkills: ['calculator'],
  getSegments: (isZh: boolean) => [
    {
      title: isZh ? '标的概览' : 'Asset Overview',
      focus: isZh ? '市场阶段、关键假设与对标框架' : 'Market phase, key assumptions, and benchmark frame',
      animationType: 'none',
      agentType: 'stocks_overview',
      contextMode: 'independent',
      sourceIds: ['asset_profile'],
    },
    {
      title: isZh ? '价格结构' : 'Price Structure',
      focus: isZh ? '趋势强度、波动与关键位' : 'Trend strength, volatility, and key levels',
      animationType: 'stats',
      agentType: 'stocks_technical',
      contextMode: 'build_upon',
      sourceIds: ['price_action'],
    },
    {
      title: isZh ? '估值与质量' : 'Valuation & Quality',
      focus: isZh ? '估值分位、增长质量与修正路径' : 'Valuation percentile, growth quality, and revisions',
      animationType: 'comparison',
      agentType: 'stocks_fundamental',
      contextMode: 'build_upon',
      sourceIds: ['valuation_health'],
    },
    {
      title: isZh ? '风险与催化' : 'Risk & Catalysts',
      focus: isZh ? '事件催化、下行触发与防守策略' : 'Catalysts, downside triggers, and defensive plans',
      animationType: 'comparison',
      agentType: 'stocks_risk',
      contextMode: 'build_upon',
      sourceIds: ['risk_events'],
    },
    {
      title: isZh ? '结论与执行' : 'Final Recommendation',
      focus: isZh ? '方向判断、置信区间与执行纪律' : 'Directional stance, confidence band, and execution discipline',
      animationType: 'none',
      agentType: 'stocks_prediction',
      contextMode: 'all',
      sourceIds: ['asset_profile', 'price_action', 'valuation_health', 'risk_events'],
    },
  ],
};
