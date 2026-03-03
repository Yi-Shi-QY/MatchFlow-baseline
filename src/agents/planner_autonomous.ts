import { AgentConfig, AgentContext } from "./types";

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

function resolveAllowedAgentTypes(context: AgentContext): string[] {
  const fromRoute = dedupeNonEmptyStrings(context.allowedAgentTypes);
  if (fromRoute.length > 0) return fromRoute;

  const fromPlanning = dedupeNonEmptyStrings(context.matchData?.sourceContext?.planning?.allowedAgentTypes);
  if (fromPlanning.length > 0) return fromPlanning;

  const requiredAgents = dedupeNonEmptyStrings(context.requiredAgentIds);
  if (requiredAgents.length > 0) return requiredAgents;

  const requiredFromPlanning = dedupeNonEmptyStrings(context.matchData?.sourceContext?.planning?.requiredAgents);
  if (requiredFromPlanning.length > 0) return requiredFromPlanning;

  return ["general"];
}

function resolveAllowedAnimationTypes(context: AgentContext): string[] {
  if (!context.includeAnimations) {
    return ["none"];
  }

  const fromPlanning = dedupeNonEmptyStrings(context.matchData?.sourceContext?.planning?.allowedAnimationTypes);
  if (fromPlanning.length > 0) return [...fromPlanning, "none"];

  const fromLegacy = dedupeNonEmptyStrings(context.matchData?.sourceContext?.planning?.animationTypes);
  if (fromLegacy.length > 0) return [...fromLegacy, "none"];

  return ["none"];
}

function buildPrompt(
  target: string,
  domainId: string,
  matchData: string,
  language: "en" | "zh",
  allowedAgentTypes: string[],
  allowedAnimationTypes: string[],
  planningReason: string,
) {
  return `
You are a Domain Analysis Planning Director.
Design a custom analysis segment plan as a strict JSON array.

Target: ${target}
Domain: ${domainId}
Language: ${language}
Allowed agentType values: ${allowedAgentTypes.join(", ")}
Allowed animationType values: ${allowedAnimationTypes.join(", ")}
Route reason: ${planningReason}

RULES:
1. Return 3 to 6 segments.
2. Every segment must include exactly: "title", "focus", "animationType", "agentType", "contextMode".
3. "agentType" must be one of: ${allowedAgentTypes.join(", ")}.
4. "animationType" must be one of: ${allowedAnimationTypes.join(", ")}.
5. "contextMode" must be one of: "build_upon", "independent", "compare", "all".
6. Output JSON array only. No markdown, no explanation.
7. If language is "zh", use Chinese for "title" and "focus".

INPUT DATA:
${matchData}
`;
}

export const plannerAutonomousAgent: AgentConfig = {
  id: "planner_autonomous",
  name: "Autonomous Planner",
  description: "Manually plans the analysis structure for custom requests.",
  skills: [],
  systemPrompt: (context) => {
    const lang = context.language === "zh" ? "zh" : "en";
    const domainId = context.domainId || resolveDomainId(context.matchData);
    const target = resolveAnalysisTarget(context.matchData, lang);
    const allowedAgentTypes = resolveAllowedAgentTypes(context);
    const allowedAnimationTypes = resolveAllowedAnimationTypes(context);
    const planningReason =
      typeof context.planningReason === "string" && context.planningReason.trim()
        ? context.planningReason.trim()
        : "unspecified";

    return buildPrompt(
      target,
      domainId,
      JSON.stringify(context.matchData),
      lang,
      allowedAgentTypes,
      allowedAnimationTypes,
      planningReason,
    );
  },
};
