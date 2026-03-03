import { AgentConfig } from "./types";

const FOOTBALL_TEMPLATE_OPTIONS = ["basic", "standard", "odds_focused", "comprehensive"];

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

function buildPlannerPrompt(
  primary: string,
  secondary: string,
  matchData: string,
  language: "en" | "zh",
) {
  const templateOptions = FOOTBALL_TEMPLATE_OPTIONS.join(", ");

  return `
You are a Senior Football Analysis Director. Select the best analysis template for ${primary} vs ${secondary}.
${language === "zh" ? "Respond in Chinese if you need natural language, but you should output only tool call payload." : ""}

TASK:
Evaluate source richness and choose the most appropriate plan template via \`select_plan_template\`.

INSTRUCTIONS:
1. Analyze the provided data and sourceContext.
2. Choose exactly one template from: (${templateOptions}).
3. Call \`select_plan_template\` with \`templateType\`, \`language\` ("${language}"), and \`includeAnimations\` (true/false).
4. IMPORTANT: Output only the tool call, no extra text.
5. Stop after tool call.

Match Data: ${matchData}
`;
}

export const plannerTemplateAgent: AgentConfig = {
  id: "planner_template",
  name: "Template Planner",
  description: "Selects a predefined analysis plan template.",
  skills: ["select_plan_template"],
  systemPrompt: ({ matchData, language, includeAnimations }) => {
    const lang = language === "zh" ? "zh" : "en";
    const { primary, secondary } = resolvePlannerTargets(matchData, lang);
    const basePrompt = buildPlannerPrompt(primary, secondary, JSON.stringify(matchData), lang);

    return `${basePrompt}\n\nUSER PREFERENCE:\nInclude Animations: ${includeAnimations ? "Yes" : "No"}`;
  },
};
