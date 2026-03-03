import { AgentConfig } from "./types";

const prompts = {
  en: (analysisText: string) => `
Analyze the following analysis text and extract 3-5 key "tags" or insights.

ANALYSIS TEXT:
${analysisText}

RULES:
- Tags should be short (2-4 words).
- Classify each tag as "home", "away", or "neutral".
- Use "neutral" when side ownership is unclear.
- You may include a color hint if useful.

OUTPUT FORMAT:
Output ONLY one <tags> block containing a valid JSON array.
<tags>
[
  { "label": "Demand Surge", "team": "neutral", "color": "emerald" },
  { "label": "Execution Risk", "team": "neutral", "color": "blue" },
  { "label": "Margin Pressure", "team": "away", "color": "zinc" }
]
</tags>
  `,
  zh: (analysisText: string) => `
请分析下面的分析文本，并提取 3-5 个关键“标签”或洞察。

分析文本：
${analysisText}

规则：
- 标签应简短（2-4 个字或词）。
- 每个标签需标注 team：'home'、'away' 或 'neutral'。
- 当归属不明确时，统一使用 'neutral'。
- 如有必要，可给出 color 字段。
- 所有标签文本请使用中文。

输出格式：
仅输出一个包含合法 JSON 数组的 <tags> 区块。
<tags>
[
  { "label": "需求走强", "team": "neutral", "color": "emerald" },
  { "label": "执行风险", "team": "neutral", "color": "blue" },
  { "label": "利润承压", "team": "away", "color": "zinc" }
]
</tags>
  `,
};

export const tagAgent: AgentConfig = {
  id: "tag",
  name: "Tag Extractor",
  description: "Extracts key tags from analysis text.",
  skills: [],
  systemPrompt: ({ analysisText, language }) => {
    const promptGen = language === "zh" ? prompts.zh : prompts.en;
    return promptGen(analysisText || "");
  },
};
