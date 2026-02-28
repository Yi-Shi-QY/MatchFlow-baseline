export const basicTemplate = (isZh: boolean) => [
  { 
    title: isZh ? "比赛概览" : "Match Overview", 
    focus: isZh ? "背景与关键点" : "Context and stakes", 
    animationType: "none", 
    agentType: "overview", 
    contextMode: "independent" 
  },
  { 
    title: isZh ? "赛前预测" : "Match Prediction", 
    focus: isZh ? "最终预测与结论" : "Final prediction and conclusion", 
    animationType: "none", 
    agentType: "prediction", 
    contextMode: "all" 
  }
];
