import { AgentConfig } from './types';

const prompts = {
  en: (previousAnalysis: string, matchData: string) => `
You are a Senior Data Analyst. Based on the detailed analysis segments below, generate a final conclusion that can work across different domains (sports, operations, etc.).

**PREVIOUS ANALYSIS:**
${previousAnalysis}

**INPUT DATA:**
${matchData}

**OUTPUT FORMAT:**
Output ONLY one <summary> block with valid JSON.
<summary>
{
  "prediction": "Final conclusion text (concise and actionable)",
  "keyFactors": ["factor 1", "factor 2", "factor 3"],
  "outcomeDistribution": [
    { "label": "Scenario A", "value": 55 },
    { "label": "Scenario B", "value": 30 },
    { "label": "Scenario C", "value": 15 }
  ],
  "conclusionCards": [
    { "label": "Primary Outlook", "value": "Scenario A", "confidence": 72 },
    { "label": "Risk Level", "value": "Medium" }
  ],
  "winProbability": { "home": 40, "draw": 30, "away": 30 },
  "expectedGoals": { "home": 1.5, "away": 1.2 }
}
</summary>

RULES:
- prediction must be a single concise paragraph.
- keyFactors must contain 2-5 short items.
- outcomeDistribution should contain 2-5 entries with numeric values (0-100). If not applicable, return [].
- conclusionCards should contain 1-4 compact cards. If not applicable, return [].
- winProbability/expectedGoals are OPTIONAL and should only be included when input is clearly a two-sided sports match.
  `,
  zh: (previousAnalysis: string, matchData: string) => `
你是一位资深数据分析师。请基于以下分阶段分析内容，生成可用于通用场景（体育、经营分析等）的最终结论。

**前序分析：**
${previousAnalysis}

**输入数据：**
${matchData}

**输出格式：**
仅输出一个包含合法 JSON 的 <summary> 标签。重要：prediction 和 keyFactors 必须使用中文。
<summary>
{
  "prediction": "最终结论（简洁、明确、可执行）",
  "keyFactors": ["关键因素 1", "关键因素 2", "关键因素 3"],
  "outcomeDistribution": [
    { "label": "情景A", "value": 55 },
    { "label": "情景B", "value": 30 },
    { "label": "情景C", "value": 15 }
  ],
  "conclusionCards": [
    { "label": "核心判断", "value": "情景A", "confidence": 72 },
    { "label": "风险等级", "value": "中" }
  ],
  "winProbability": { "home": 40, "draw": 30, "away": 30 },
  "expectedGoals": { "home": 1.5, "away": 1.2 }
}
</summary>

规则：
- prediction 必须是一段简洁结论。
- keyFactors 保持 2-5 条短句。
- outcomeDistribution 返回 2-5 条分布项，value 为 0-100 的数字；若不适用返回 []。
- conclusionCards 返回 1-4 张简短结论卡；若不适用返回 []。
- winProbability/expectedGoals 为可选，仅在明显是双方体育比赛场景时再填写。
  `,
};

export const summaryAgent: AgentConfig = {
  id: 'summary',
  name: 'Summary Analyst',
  description: 'Generates a final domain-agnostic summary and conclusion.',
  skills: ['calculator'],
  systemPrompt: ({ matchData, previousAnalysis, language }) => {
    const promptGen = language === 'zh' ? prompts.zh : prompts.en;
    return promptGen(previousAnalysis || '', JSON.stringify(matchData));
  },
};
