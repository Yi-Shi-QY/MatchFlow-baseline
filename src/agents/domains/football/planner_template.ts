import { AgentConfig } from "../../types";

function resolveTargets(matchData: any): { home: string; away: string } {
  return {
    home: matchData?.homeTeam?.name || matchData?.participants?.home?.name || "Home Team",
    away: matchData?.awayTeam?.name || matchData?.participants?.away?.name || "Away Team",
  };
}

function buildPrompt(home: string, away: string, matchData: string, language: "en" | "zh") {
  return `
You are a Senior Football Analysis Director. Select the best analysis template for ${home} vs ${away}.
${language === "zh" ? "If natural language is needed, use Chinese. Output only the tool call payload." : ""}

TASK:
Evaluate source richness and choose the most appropriate template via \`select_plan_template\`.

INSTRUCTIONS:
1. Analyze input data and sourceContext.
2. Choose exactly one template from: (basic, standard, odds_focused, comprehensive).
3. Call \`select_plan_template\` with \`templateType\`, \`language\` ("${language}"), and \`includeAnimations\` (true/false).
4. IMPORTANT: Output only the tool call with no extra text.
5. Stop after the tool call.

Match Data: ${matchData}
`;
}

export const footballPlannerTemplateAgent: AgentConfig = {
  id: "football_planner_template",
  name: "Football Template Planner",
  description: "Selects a football template plan based on source richness.",
  skills: ["select_plan_template"],
  systemPrompt: ({ matchData, language, includeAnimations }) => {
    const lang = language === "zh" ? "zh" : "en";
    const { home, away } = resolveTargets(matchData);
    const basePrompt = buildPrompt(home, away, JSON.stringify(matchData), lang);
    return `${basePrompt}\n\nUSER PREFERENCE:\nInclude Animations: ${includeAnimations ? "Yes" : "No"}`;
  },
};

