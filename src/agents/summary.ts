import { AgentConfig } from './types';

export const summaryAgent: AgentConfig = {
  id: 'summary',
  name: 'Summary Analyst',
  description: 'Generates a final match summary and prediction.',
  skills: ['calculator'],
  systemPrompt: ({ matchData, previousAnalysis }) => `
You are a Senior Football Analyst. Based on the detailed analysis segments provided below, generate a final match summary and prediction.

**PREVIOUS ANALYSIS:**
${previousAnalysis}

**MATCH DATA:**
${JSON.stringify(matchData)}

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
  `
};
