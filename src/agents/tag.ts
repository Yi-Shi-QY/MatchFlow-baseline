import { AgentConfig } from './types';

export const tagAgent: AgentConfig = {
  id: 'tag',
  name: 'Tag Extractor',
  description: 'Extracts key tags from analysis text.',
  skills: [],
  systemPrompt: ({ analysisText }) => `
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
  `
};
