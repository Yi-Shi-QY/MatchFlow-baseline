import { PlanTemplate } from '../types';

export const standardTemplate: PlanTemplate = {
  id: 'standard',
  name: 'Standard Template',
  description: 'Includes overview, stats, tactical battle, and prediction.',
  rule: 'Use by default for a balanced analysis when standard match data is available.',
  getSegments: (isZh: boolean) => [
    { 
      title: isZh ? "比赛概览" : "Match Overview", 
      focus: isZh ? "背景与关键点" : "Context and stakes", 
      animationType: "none", 
      agentType: "overview", 
      contextMode: "independent" 
    },
    { 
      title: isZh ? "近期状态" : "Recent Form", 
      focus: isZh ? "对比最近5场比赛" : "Compare last 5 games", 
      animationType: "stats", 
      agentType: "stats", 
      contextMode: "build_upon" 
    },
    { 
      title: isZh ? "战术对决" : "Tactical Battle", 
      focus: isZh ? "阵型与关键对位" : "Formations and key matchups", 
      animationType: "tactical", 
      agentType: "tactical", 
      contextMode: "build_upon" 
    },
    { 
      title: isZh ? "赛前预测" : "Match Prediction", 
      focus: isZh ? "最终预测与结论" : "Final prediction and conclusion", 
      animationType: "none", 
      agentType: "prediction", 
      contextMode: "all" 
    }
  ]
};
