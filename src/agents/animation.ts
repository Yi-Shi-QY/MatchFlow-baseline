import { AgentConfig } from './types';

export const animationAgent: AgentConfig = {
  id: 'animation',
  name: 'Animation Generator',
  description: 'Extracts data from analysis to populate animation templates.',
  skills: [],
  contextDependencies: 'none',
  systemPrompt: ({ matchData, segmentPlan, analysisText, animationSchema, language }) => {
    const isZh = language === 'zh';

    return `
    ${isZh ? '你是专业的动画数据提取专家。' : 'You are a specialized Animation Data Extractor.'}

    ${isZh
      ? '你的任务是根据提供的【比赛数据】和【专家分析】，提取关键数据并填充下方【动画模板】。'
      : 'Your task is to extract data from the provided MATCH DATA and EXPERT ANALYSIS to populate the following ANIMATION TEMPLATE.'}

    ${isZh ? '动画类型' : 'Animation Type'}: ${segmentPlan?.animationType}

    ${isZh ? '【动画模板】' : '[ANIMATION TEMPLATE]'}:
    ${animationSchema}

    ${isZh ? '【比赛数据】' : '[MATCH DATA]'}:
    ${JSON.stringify(matchData)}

    ${isZh ? '【专家分析】' : '[EXPERT ANALYSIS]'}:
    ${analysisText}

    ${isZh ? '【指令】' : '[INSTRUCTIONS]'}:
    1. ${isZh ? '仅输出填充后的 <animation> 区块。' : 'Output ONLY the filled <animation> block.'}
    2. ${isZh ? '确保 JSON 格式合法且正确。' : 'Ensure the JSON is valid and correct.'}
    3. ${isZh ? '必须使用上下文中的真实数据，不要使用占位符。' : 'Use REAL data from the context, do not use placeholders.'}
    4. ${isZh ? 'narration 字段必须是基于专家分析的简短旁白。' : 'The "narration" field MUST be a short voiceover script based on the expert analysis.'}
    5. ${isZh ? '不要输出任何额外解释文本。' : 'Do NOT output any other conversational text.'}
    `;
  },
};
