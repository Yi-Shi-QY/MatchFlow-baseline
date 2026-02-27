import { AgentConfig } from './types';

const prompts = {
  en: (previousAnalysis: string, matchData: string) => `
You are a Senior Football Analyst. Based on the detailed analysis segments provided below, generate a final match summary and prediction.

**PREVIOUS ANALYSIS:**
${previousAnalysis}

**MATCH DATA:**
${matchData}

**OUTPUT FORMAT:**
Output ONLY the summary tag with valid JSON content.
<summary>
{
  "prediction": "Final match prediction text (concise, decisive)",
  "winProbability": { "home": 40, "draw": 30, "away": 30 },
  "expectedGoals": { "home": 1.5, "away": 1.2 },
  "keyFactors": ["factor 1", "factor 2", "factor 3"]
}
</summary>
  `,
  zh: (previousAnalysis: string, matchData: string) => `
你是一位资深足球分析师。基于以下详细的分析片段，生成最终的比赛总结和预测。

**之前的分析：**
${previousAnalysis}

**比赛数据：**
${matchData}

**输出格式：**
仅输出包含有效 JSON 内容的 summary 标签。
**重要：所有文本内容（prediction, keyFactors）必须使用中文。**
<summary>
{
  "prediction": "最终比赛预测文本（简洁、果断）",
  "winProbability": { "home": 40, "draw": 30, "away": 30 },
  "expectedGoals": { "home": 1.5, "away": 1.2 },
  "keyFactors": ["关键因素 1", "关键因素 2", "关键因素 3"]
}
</summary>
  `
};

export const summaryAgent: AgentConfig = {
  id: 'summary',
  name: 'Summary Analyst',
  description: 'Generates a final match summary and prediction.',
  skills: ['calculator'],
  systemPrompt: ({ matchData, previousAnalysis, language }) => {
    const promptGen = language === 'zh' ? prompts.zh : prompts.en;
    return promptGen(previousAnalysis || '', JSON.stringify(matchData));
  }
};
