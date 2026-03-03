import { AgentConfig } from "./types";

const DEFAULT_TEMPLATE_OPTIONS = ["basic", "standard", "odds_focused", "comprehensive"];

function dedupeNonEmptyStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return Array.from(new Set(normalized));
}

function resolveDomainId(matchData: any): string {
  if (typeof matchData?.sourceContext?.domainId === "string" && matchData.sourceContext.domainId.trim()) {
    return matchData.sourceContext.domainId.trim();
  }
  if (typeof matchData?.analysisConfig?.domainId === "string" && matchData.analysisConfig.domainId.trim()) {
    return matchData.analysisConfig.domainId.trim();
  }
  return "default";
}

function resolveTemplateCandidates(matchData: any): string[] {
  const planning = matchData?.sourceContext?.planning || {};
  const candidates = dedupeNonEmptyStrings(planning?.templateCandidates);
  if (candidates.length > 0) return candidates;

  const available = dedupeNonEmptyStrings(planning?.availableTemplates);
  if (available.length > 0) return available;

  const forcedTemplate =
    typeof planning?.templateId === "string" && planning.templateId.trim().length > 0
      ? planning.templateId.trim()
      : typeof planning?.templateType === "string" && planning.templateType.trim().length > 0
        ? planning.templateType.trim()
        : "";
  if (forcedTemplate) return [forcedTemplate];

  return [...DEFAULT_TEMPLATE_OPTIONS];
}

function resolveAnalysisTarget(matchData: any, language: "en" | "zh"): string {
  const home = typeof matchData?.homeTeam?.name === "string" ? matchData.homeTeam.name.trim() : "";
  const away = typeof matchData?.awayTeam?.name === "string" ? matchData.awayTeam.name.trim() : "";
  if (home && away) {
    return `${home} vs ${away}`;
  }

  const candidates = [
    matchData?.analysisSubject,
    matchData?.subject,
    matchData?.title,
    matchData?.name,
    matchData?.customInfo?.title,
    matchData?.customInfo?.name,
    matchData?.asset?.ticker,
    matchData?.asset?.name,
    matchData?.entity?.name,
    matchData?.league,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  if (candidates.length > 0) {
    return candidates[0];
  }

  return language === "zh" ? "当前分析对象" : "Current analysis target";
}

function buildPlannerPrompt(
  target: string,
  matchData: string,
  language: "en" | "zh",
  domainId: string,
  templateCandidates: string[],
  includeAnimations: boolean,
) {
  const templateOptions = templateCandidates.join(", ");

  return `
You are a Domain Analysis Planning Director.
Select the most appropriate plan template for the current target.

Target: ${target}
Domain: ${domainId}
Template candidates: ${templateOptions}
Language: ${language}
Include Animations: ${includeAnimations ? "Yes" : "No"}

TASK:
Evaluate source richness and choose exactly one template id from the candidate list.

INSTRUCTIONS:
1. Analyze the provided data and sourceContext.
2. Call \`select_plan_template\` with \`templateType\`, \`language\` ("${language}"), and \`includeAnimations\` (${includeAnimations ? "true" : "false"}).
3. The selected \`templateType\` must be one of: ${templateOptions}.
4. Output only the tool call payload. Do not output extra prose.
5. Stop after tool call.

INPUT DATA:
${matchData}
`;
}

export const plannerTemplateAgent: AgentConfig = {
  id: "planner_template",
  name: "Template Planner",
  description: "Selects a predefined analysis plan template.",
  skills: ["select_plan_template"],
  systemPrompt: ({ matchData, language, includeAnimations }) => {
    const lang = language === "zh" ? "zh" : "en";
    const target = resolveAnalysisTarget(matchData, lang);
    const domainId = resolveDomainId(matchData);
    const templateCandidates = resolveTemplateCandidates(matchData);
    return buildPlannerPrompt(
      target,
      JSON.stringify(matchData),
      lang,
      domainId,
      templateCandidates,
      Boolean(includeAnimations),
    );
  },
};
