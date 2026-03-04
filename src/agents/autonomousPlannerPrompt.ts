import type {
  AgentContext,
  PlanningAgentCapability,
  PlanningAnimationCapability,
  PlanningSourceCapability,
} from "./types";

type Language = "en" | "zh";

interface BuildPromptOptions {
  context: AgentContext;
  language: Language;
  domainId: string;
  target: string;
  plannerTitle: string;
  fallbackAgentTypes?: string[];
  fallbackAnimationTypes?: string[];
  fallbackSourceIds?: string[];
  extraInstructions?: string[];
}

function dedupeNonEmptyStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return Array.from(new Set(normalized));
}

function describeContextDependencies(
  deps: PlanningAgentCapability["contextDependencies"],
): string {
  if (deps === "none") return "none";
  if (deps === "all" || deps === undefined) return "all";
  if (!Array.isArray(deps) || deps.length === 0) return "all";
  return deps.join(", ");
}

function resolveAllowedAgentTypes(
  context: AgentContext,
  fallback: string[],
): string[] {
  const fromRoute = dedupeNonEmptyStrings(context.allowedAgentTypes);
  if (fromRoute.length > 0) return fromRoute;

  const fromCatalog = Array.isArray(context.planningAgentCatalog)
    ? context.planningAgentCatalog
        .map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : ""))
        .filter((id) => id.length > 0)
    : [];
  if (fromCatalog.length > 0) return Array.from(new Set(fromCatalog));

  const fromPlanning = dedupeNonEmptyStrings(
    context.matchData?.sourceContext?.planning?.allowedAgentTypes,
  );
  if (fromPlanning.length > 0) return fromPlanning;

  const requiredAgents = dedupeNonEmptyStrings(context.requiredAgentIds);
  if (requiredAgents.length > 0) return requiredAgents;

  const requiredFromPlanning = dedupeNonEmptyStrings(
    context.matchData?.sourceContext?.planning?.requiredAgents,
  );
  if (requiredFromPlanning.length > 0) return requiredFromPlanning;

  return fallback;
}

function resolveAllowedAnimationTypes(
  context: AgentContext,
  fallback: string[],
): string[] {
  if (!context.includeAnimations) {
    return ["none"];
  }

  const fromRoute = dedupeNonEmptyStrings(context.allowedAnimationTypes);
  const fromCatalog = Array.isArray(context.planningAnimationCatalog)
    ? context.planningAnimationCatalog
        .map((entry) => (typeof entry?.type === "string" ? entry.type.trim() : ""))
        .filter((type) => type.length > 0)
    : [];
  const fromPlanning = dedupeNonEmptyStrings(
    context.matchData?.sourceContext?.planning?.allowedAnimationTypes,
  );
  const fromLegacy = dedupeNonEmptyStrings(
    context.matchData?.sourceContext?.planning?.animationTypes,
  );

  const merged = Array.from(
    new Set([
      ...fromRoute,
      ...fromCatalog,
      ...fromPlanning,
      ...fromLegacy,
      ...fallback,
      "none",
    ]),
  );
  return merged.length > 0 ? merged : ["none"];
}

function resolveAllowedSourceIds(
  context: AgentContext,
  fallback: string[],
): string[] {
  const fromRoute = dedupeNonEmptyStrings(context.allowedSourceIds);
  if (fromRoute.length > 0) return fromRoute;

  const fromCatalog = Array.isArray(context.planningSourceCatalog)
    ? context.planningSourceCatalog
        .filter((source) => source?.selected === true || source?.selected === undefined)
        .map((source) =>
          typeof source?.id === "string" ? source.id.trim() : "",
        )
        .filter((id) => id.length > 0)
    : [];
  if (fromCatalog.length > 0) return Array.from(new Set(fromCatalog));

  const fromIds = dedupeNonEmptyStrings(context.matchData?.sourceContext?.selectedSourceIds);
  if (fromIds.length > 0) return fromIds;

  const selectedSources =
    context.matchData?.sourceContext?.selectedSources &&
    typeof context.matchData.sourceContext.selectedSources === "object"
      ? context.matchData.sourceContext.selectedSources
      : null;
  if (selectedSources) {
    const fromMap = Object.entries(selectedSources)
      .filter(
        ([key, value]) =>
          typeof key === "string" && key.trim().length > 0 && value === true,
      )
      .map(([key]) => key.trim());
    if (fromMap.length > 0) return fromMap;
  }

  return fallback;
}

function buildAgentCatalogLines(
  context: AgentContext,
  allowedAgentTypes: string[],
): string[] {
  const catalog = Array.isArray(context.planningAgentCatalog)
    ? context.planningAgentCatalog
    : [];
  const byId = new Map<string, PlanningAgentCapability>();
  catalog.forEach((entry) => {
    if (!entry || typeof entry.id !== "string" || !entry.id.trim()) return;
    byId.set(entry.id.trim(), entry);
  });

  return allowedAgentTypes.map((agentId) => {
    const entry = byId.get(agentId);
    if (!entry) return `- ${agentId}`;
    const name = entry.name?.trim() ? entry.name.trim() : agentId;
    const description = entry.description?.trim()
      ? entry.description.trim()
      : "No description";
    const deps = describeContextDependencies(entry.contextDependencies);
    return `- ${agentId} | name: ${name} | deps: ${deps} | desc: ${description}`;
  });
}

function buildAnimationCatalogLines(
  context: AgentContext,
  allowedAnimationTypes: string[],
): string[] {
  const catalog = Array.isArray(context.planningAnimationCatalog)
    ? context.planningAnimationCatalog
    : [];
  const byType = new Map<string, PlanningAnimationCapability>();
  catalog.forEach((entry) => {
    if (!entry || typeof entry.type !== "string" || !entry.type.trim()) return;
    byType.set(entry.type.trim(), entry);
  });

  return allowedAnimationTypes.map((type) => {
    if (type === "none") return "- none | use for narrative-only segments";
    const entry = byType.get(type);
    if (!entry) return `- ${type}`;
    const templateId = entry.templateId?.trim() || "default";
    const note = entry.note?.trim() || "Use when visualization clarifies the segment";
    return `- ${type} | templateId: ${templateId} | note: ${note}`;
  });
}

function buildSourceCatalogLines(
  context: AgentContext,
  allowedSourceIds: string[],
): string[] {
  const catalog = Array.isArray(context.planningSourceCatalog)
    ? context.planningSourceCatalog
    : [];
  const byId = new Map<string, PlanningSourceCapability>();
  catalog.forEach((entry) => {
    if (!entry || typeof entry.id !== "string" || !entry.id.trim()) return;
    byId.set(entry.id.trim(), entry);
  });

  return allowedSourceIds.map((sourceId) => {
    const entry = byId.get(sourceId);
    if (!entry) return `- ${sourceId}`;
    const labelKey = entry.labelKey?.trim() || "n/a";
    const descriptionKey = entry.descriptionKey?.trim() || "n/a";
    return `- ${sourceId} | labelKey: ${labelKey} | descriptionKey: ${descriptionKey}`;
  });
}

export function resolveAnalysisTarget(
  matchData: any,
  language: Language,
): string {
  const home =
    typeof matchData?.homeTeam?.name === "string" ? matchData.homeTeam.name.trim() : "";
  const away =
    typeof matchData?.awayTeam?.name === "string" ? matchData.awayTeam.name.trim() : "";
  if (home && away) return `${home} vs ${away}`;

  const candidates = [
    matchData?.analysisSubject,
    matchData?.subject,
    matchData?.title,
    matchData?.name,
    matchData?.assetProfile?.symbol,
    matchData?.assetProfile?.assetName,
    matchData?.siteProfile?.subjectName,
    matchData?.entity?.name,
    matchData?.league,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  if (candidates.length > 0) return candidates[0];

  return language === "zh" ? "当前分析对象" : "Current analysis target";
}

export function resolvePlannerDomainId(context: AgentContext): string {
  if (typeof context.domainId === "string" && context.domainId.trim().length > 0) {
    return context.domainId.trim();
  }
  if (
    typeof context.matchData?.sourceContext?.domainId === "string" &&
    context.matchData.sourceContext.domainId.trim().length > 0
  ) {
    return context.matchData.sourceContext.domainId.trim();
  }
  return "default";
}

export function buildAutonomousPlannerPrompt(
  options: BuildPromptOptions,
): string {
  const {
    context,
    language,
    domainId,
    target,
    plannerTitle,
    fallbackAgentTypes = ["general"],
    fallbackAnimationTypes = ["none"],
    fallbackSourceIds = [],
    extraInstructions = [],
  } = options;

  const allowedAgentTypes = resolveAllowedAgentTypes(context, fallbackAgentTypes);
  const allowedAnimationTypes = resolveAllowedAnimationTypes(
    context,
    fallbackAnimationTypes,
  );
  const allowedSourceIds = resolveAllowedSourceIds(context, fallbackSourceIds);

  const agentCatalogLines = buildAgentCatalogLines(context, allowedAgentTypes);
  const animationCatalogLines = buildAnimationCatalogLines(
    context,
    allowedAnimationTypes,
  );
  const sourceCatalogLines = buildSourceCatalogLines(context, allowedSourceIds);

  const sourceRule =
    allowedSourceIds.length > 0
      ? `6. "sourceIds" must be a non-empty string array chosen from: ${allowedSourceIds.join(", ")}.`
      : `6. "sourceIds" must be a non-empty string array aligned with sourceContext.selectedSources.`;

  const extraRuleBlock =
    extraInstructions.length > 0
      ? `\nEXTRA DOMAIN RULES:\n${extraInstructions.map((line) => `- ${line}`).join("\n")}\n`
      : "";

  return `
You are ${plannerTitle}.
Design a custom analysis segment plan as strict JSON array.

Target: ${target}
Domain: ${domainId}
Language: ${language}
Route reason: ${
    typeof context.planningReason === "string" && context.planningReason.trim().length > 0
      ? context.planningReason.trim()
      : "unspecified"
  }

AGENT CAPABILITY CATALOG:
${agentCatalogLines.join("\n") || "- (none)"}

ANIMATION CATALOG:
${animationCatalogLines.join("\n") || "- none"}

SOURCE CATALOG:
${sourceCatalogLines.join("\n") || "- derive from selectedSources"}
${extraRuleBlock}
RULES:
1. Return 3 to 6 segments.
2. Every segment must include exactly: "title", "focus", "animationType", "agentType", "contextMode", "sourceIds".
3. "agentType" must be one of: ${allowedAgentTypes.join(", ")}.
4. "animationType" must be one of: ${allowedAnimationTypes.join(", ")}.
5. "contextMode" must be one of: "build_upon", "independent", "compare", "all".
${sourceRule}
7. Use AGENT CAPABILITY CATALOG to assign the most suitable expert to each segment.
8. Use ANIMATION CATALOG only when visualization improves understanding for that segment.
9. Output strict JSON array only. No markdown and no commentary.
10. If language is "zh", write Chinese for title and focus.

INPUT DATA:
${JSON.stringify(context.matchData)}
`;
}
