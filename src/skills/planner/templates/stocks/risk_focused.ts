import { PlanTemplate } from '../../types';

export const stocksRiskFocusedTemplate: PlanTemplate = {
  id: 'stocks_risk_focused',
  version: '1.0.0',
  name: 'Stocks Risk-Focused Template',
  description: 'Risk-driven flow for catalyst-sensitive setups.',
  rule: 'Use when event/catalyst risk dominates available information.',
  requiredAgents: ['stocks_overview', 'stocks_risk', 'stocks_prediction'],
  requiredSkills: [],
  getSegments: (isZh: boolean) => [
    {
      title: isZh ? '风险背景' : 'Risk Context',
      focus: isZh ? '事件驱动与暴露面识别' : 'Event exposure and scenario framing',
      animationType: 'none',
      agentType: 'stocks_overview',
      contextMode: 'independent',
      sourceIds: ['asset_profile', 'risk_events'],
    },
    {
      title: isZh ? '风险雷达' : 'Risk Radar',
      focus: isZh ? '催化剂、触发器与失效条件' : 'Catalysts, triggers, and invalidation checkpoints',
      animationType: 'comparison',
      agentType: 'stocks_risk',
      contextMode: 'build_upon',
      sourceIds: ['risk_events'],
    },
    {
      title: isZh ? '结论与应对' : 'Final Stance & Controls',
      focus: isZh ? '结论、对冲与退出规则' : 'Final stance, hedging, and exit rules',
      animationType: 'none',
      agentType: 'stocks_prediction',
      contextMode: 'all',
      sourceIds: ['asset_profile', 'price_action', 'valuation_health', 'risk_events'],
    },
  ],
};
