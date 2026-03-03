import { AgentConfig } from "../../types";

function resolveTargets(matchData: any): { home: string; away: string } {
  return {
    home: matchData?.homeTeam?.name || matchData?.participants?.home?.name || "Home Team",
    away: matchData?.awayTeam?.name || matchData?.participants?.away?.name || "Away Team",
  };
}

function buildPrompt(home: string, away: string, matchData: string, language: "en" | "zh") {
  return `
You are a Senior Football Analysis Director. Manually plan the analysis structure for ${home} vs ${away}.
${language === "zh" ? "Output JSON only. title/focus values must be Chinese." : ""}

TASK:
The user requested a custom structure that does not fit standard templates.

RULES:
1. Logical Flow: Overview -> Form -> Tactics/Stats -> Odds Analysis -> Key Factors -> Conclusion.
2. Segment Count: 3 to 6 segments.
3. Agent Types (strict): Use only "overview", "stats", "tactical", "odds", "prediction", "general".
4. Animation Strategy (strict mapping):
   - Form / team stats => "stats"
   - Tactics / lineups / matchups => "tactical"
   - Odds / market / betting => "odds"
   - Overview / prediction => "none"
5. Context Strategy: Set "contextMode" to one of "build_upon", "independent", "compare", or "all".

OUTPUT FORMAT:
Return a strict JSON array only (no markdown code block).
Each object MUST contain: "title", "focus", "animationType", "agentType", "contextMode".

Match Data: ${matchData}
`;
}

export const footballPlannerAutonomousAgent: AgentConfig = {
  id: "football_planner_autonomous",
  name: "Football Autonomous Planner",
  description: "Builds custom football analysis plans.",
  skills: [],
  systemPrompt: ({ matchData, language }) => {
    const lang = language === "zh" ? "zh" : "en";
    const { home, away } = resolveTargets(matchData);
    return buildPrompt(home, away, JSON.stringify(matchData), lang);
  },
};

