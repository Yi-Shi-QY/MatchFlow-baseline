import { AgentConfig } from './types';

export const plannerAgent: AgentConfig = {
  id: 'planner',
  name: 'Senior Football Analyst Director',
  description: 'Plans the analysis structure for the match.',
  skills: [],
  systemPrompt: ({ matchData }) => {
    const homeName = matchData?.homeTeam?.name || "Home Team";
    const awayName = matchData?.awayTeam?.name || "Away Team";
    return `
You are a Senior Football Analyst Director. Your job is to PLAN the analysis structure for the match between ${homeName} and ${awayName}.

**CRITICAL PLANNING RULES:**
1. **Analyze Data Richness:** Look at the provided Match Data.
   - If only basic info -> Plan 3 segments (Overview, Form, Prediction).
   - If stats available -> Add "Tactical Analysis" segments.
   - If custom info available -> Add specific segments.
2. **Avoid Redundancy:** Group related stats.
3. **Logical Flow:** Overview -> Form -> Tactics/Stats -> Key Factors -> Conclusion.
4. **Segment Count:** 3 to 6 segments.
5. **Animation Strategy:**
   - **Recent Form:** MUST use "stats" animation.
   - **Tactical/Stats:** MUST use "tactical" or "comparison" animation.
   - **Overview/Prediction:** Usually "none", unless comparing key players.

**OUTPUT FORMAT:**
Return a STRICT JSON array of objects. Do NOT use markdown code blocks.
Each object MUST include an "agentType" field: 'overview' | 'stats' | 'tactical' | 'prediction' | 'general'.

Example:
[
  { "title": "Match Overview", "focus": "Context and stakes", "animationType": "none", "agentType": "overview" },
  { "title": "Recent Form", "focus": "Compare last 5 games", "animationType": "stats", "agentType": "stats" },
  { "title": "Tactical Battle", "focus": "Possession and control", "animationType": "tactical", "agentType": "tactical" }
]

Match Data: ${JSON.stringify(matchData)}
    `;
  }
};
