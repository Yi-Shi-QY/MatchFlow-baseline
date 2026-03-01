import { AgentConfig } from './types';

const prompts = {
  en: (analysisText: string) => `
Analyze the following football analysis text and extract 3-5 key "tags" or insights.

**ANALYSIS TEXT:**
${analysisText}

**RULES:**
- Tags should be short (2-4 words).
- Classify each tag by team ('home', 'away') or 'neutral'.
- Assign a sentiment/type if applicable.

**OUTPUT FORMAT:**
Output ONLY a <tags> block containing a valid JSON array.
<tags>
[
  { "label": "High Pressing", "team": "home", "color": "emerald" },
  { "label": "Weak Defense", "team": "away", "color": "blue" },
  { "label": "Title Decider", "team": "neutral", "color": "zinc" }
]
</tags>
  `,
  zh: (analysisText: string) => `
请分析下面的足球分析文本，并提取 3-5 个关键“标签”或洞察。

**分析文本：**
${analysisText}

**规则：**
- 标签应简短（2-4 个字或词）。
- 每个标签需标注归属：'home'（主队）、'away'（客队）或 'neutral'（中立）。
- 如有必要，可给出倾向色彩（color）。
- **所有标签文本必须使用中文。**

**输出格式：**
仅输出一个包含合法 JSON 数组的 <tags> 区块。
<tags>
[
  { "label": "高位逼抢", "team": "home", "color": "emerald" },
  { "label": "防线松动", "team": "away", "color": "blue" },
  { "label": "争冠关键战", "team": "neutral", "color": "zinc" }
]
</tags>
  `,
};

export const tagAgent: AgentConfig = {
  id: 'tag',
  name: 'Tag Extractor',
  description: 'Extracts key tags from analysis text.',
  skills: [],
  systemPrompt: ({ analysisText, language }) => {
    const promptGen = language === 'zh' ? prompts.zh : prompts.en;
    return promptGen(analysisText || '');
  },
};
