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
分析以下足球分析文本并提取 3-5 个关键“标签”或见解。

**分析文本：**
${analysisText}

**规则：**
- 标签应简短（2-4 个字）。
- 按球队分类每个标签（'home' - 主队, 'away' - 客队）或 'neutral' - 中立。
- 如果适用，分配情感/类型。
- **所有标签文本必须使用中文。禁止使用英文。**

**输出格式：**
仅输出包含有效 JSON 数组的 <tags> 块。
<tags>
[
  { "label": "高位逼抢", "team": "home", "color": "emerald" },
  { "label": "防守薄弱", "team": "away", "color": "blue" },
  { "label": "争冠关键战", "team": "neutral", "color": "zinc" }
]
</tags>
  `
};

export const tagAgent: AgentConfig = {
  id: 'tag',
  name: 'Tag Extractor',
  description: 'Extracts key tags from analysis text.',
  skills: [],
  systemPrompt: ({ analysisText, language }) => {
    const promptGen = language === 'zh' ? prompts.zh : prompts.en;
    return promptGen(analysisText || '');
  }
};
