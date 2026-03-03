import { AgentConfig } from "./types";

function buildEnglishPrompt(primary: string, secondary: string, matchData: string) {
  return `
You are a Senior Football Analysis Director. Manually plan the analysis structure for ${primary} vs ${secondary}.

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

function buildChinesePrompt(primary: string, secondary: string, matchData: string) {
  return `
请使用中文输出，且 title 与 focus 必须为中文。
${buildEnglishPrompt(primary, secondary, matchData)}
`;
}

function resolvePlannerTargets(
  matchData: any,
  language: "en" | "zh",
): { primary: string; secondary: string } {
  const fallbackPrimary = language === "zh" ? "主队" : "Home Team";
  const fallbackSecondary = language === "zh" ? "客队" : "Away Team";

  return {
    primary: String(
      matchData?.homeTeam?.name || matchData?.participants?.home?.name || fallbackPrimary,
    ),
    secondary: String(
      matchData?.awayTeam?.name || matchData?.participants?.away?.name || fallbackSecondary,
    ),
  };
}

export const plannerAutonomousAgent: AgentConfig = {
  id: "planner_autonomous",
  name: "Autonomous Planner",
  description: "Manually plans the analysis structure for custom requests.",
  skills: [],
  systemPrompt: ({ matchData, language }) => {
    const lang = language === "zh" ? "zh" : "en";
    const { primary, secondary } = resolvePlannerTargets(matchData, lang);
    return lang === "zh"
      ? buildChinesePrompt(primary, secondary, JSON.stringify(matchData))
      : buildEnglishPrompt(primary, secondary, JSON.stringify(matchData));
  },
};
