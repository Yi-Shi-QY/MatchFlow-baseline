export const oddsFocusedTemplate = (isZh: boolean) => [
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
    title: isZh ? "亚盘分析" : "Asian Handicap", 
    focus: isZh ? "亚洲让球盘口分析" : "Asian market analysis", 
    animationType: "odds", 
    agentType: "odds", 
    contextMode: "independent" 
  },
  { 
    title: isZh ? "欧赔分析" : "European Odds", 
    focus: isZh ? "欧洲赔率对比" : "Euro market comparison", 
    animationType: "odds", 
    agentType: "odds", 
    contextMode: "compare" 
  },
  { 
    title: isZh ? "赛前预测" : "Match Prediction", 
    focus: isZh ? "最终预测与结论" : "Final prediction and conclusion", 
    animationType: "none", 
    agentType: "prediction", 
    contextMode: "all" 
  }
];
