import { hasAgent } from "@/src/agents";
import { hasSkill } from "@/src/skills";
import { getTemplateRequirements, hasPlanTemplate } from "@/src/skills/planner";
import { getActiveAnalysisDomain } from "@/src/services/domains/registry";
import { getInstalledDomainPackManifest } from "@/src/services/domains/packStore";
import { getSettings } from "@/src/services/settings";
import { installAgentFromHub, installSkillFromHub, installTemplateFromHub } from "./hub";
import { HubEndpointHint } from "./types";

interface PlanningSnapshot {
  templateId?: string;
  requiredAgents: string[];
  requiredSkills: string[];
  hub?: HubEndpointHint;
}

export interface RecommendedExtensionSyncResult {
  sampledMatchCount: number;
  planningSnapshotCount: number;
  templateIds: string[];
  requiredAgentIds: string[];
  requiredSkillIds: string[];
  syncedTemplates: string[];
  syncedAgents: string[];
  syncedSkills: string[];
  missingTemplates: string[];
  missingAgents: string[];
  missingSkills: string[];
  errors: string[];
}

function normalizeStringArray(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizeHubHint(input: any): HubEndpointHint | undefined {
  if (!input || typeof input !== "object") return undefined;
  const baseUrl =
    typeof input.baseUrl === "string" && input.baseUrl.trim().length > 0
      ? input.baseUrl.trim()
      : undefined;
  const apiKey =
    typeof input.apiKey === "string" && input.apiKey.trim().length > 0
      ? input.apiKey.trim()
      : undefined;
  const autoInstall = typeof input.autoInstall === "boolean" ? input.autoInstall : undefined;

  if (!baseUrl && !apiKey && typeof autoInstall === "undefined") {
    return undefined;
  }

  return { baseUrl, apiKey, autoInstall };
}

function extractPlanningSnapshot(matchLike: any): PlanningSnapshot | null {
  const planning =
    matchLike?.analysisConfig?.planning && typeof matchLike.analysisConfig.planning === "object"
      ? matchLike.analysisConfig.planning
      : matchLike?.sourceContext?.planning && typeof matchLike.sourceContext.planning === "object"
        ? matchLike.sourceContext.planning
        : null;

  if (!planning) return null;

  const templateId =
    typeof planning.templateId === "string" && planning.templateId.trim().length > 0
      ? planning.templateId.trim()
      : typeof planning.templateType === "string" && planning.templateType.trim().length > 0
        ? planning.templateType.trim()
        : undefined;

  return {
    templateId,
    requiredAgents: normalizeStringArray(planning.requiredAgents),
    requiredSkills: normalizeStringArray(planning.requiredSkills),
    hub: normalizeHubHint(planning.hub),
  };
}

function assignHubHint(
  id: string,
  hint: HubEndpointHint | undefined,
  hintMap: Map<string, HubEndpointHint | undefined>,
) {
  const normalizedId = id.trim();
  if (!normalizedId) return;

  if (!hintMap.has(normalizedId)) {
    hintMap.set(normalizedId, hint);
    return;
  }

  const existing = hintMap.get(normalizedId);
  if (!existing && hint) {
    hintMap.set(normalizedId, hint);
  }
}

function toSortedArray(values: Set<string>): string[] {
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

async function fetchServerMatches(limit: number): Promise<any[]> {
  const settings = getSettings();
  const baseUrl = String(settings.matchDataServerUrl || "").trim();
  if (!baseUrl) {
    throw new Error("Match Data Server URL is not configured.");
  }

  const apiKey = String(settings.matchDataApiKey || "").trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const url = new URL(`/matches?limit=${encodeURIComponent(String(limit))}`, baseUrl).toString();
  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
  }

  const payload = await response.json().catch(() => null);
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error("Invalid /matches response format.");
  }

  return payload.data;
}

export async function syncRecommendedExtensions(
  options?: { sampleSize?: number },
): Promise<RecommendedExtensionSyncResult> {
  const sampleSize = Math.min(Math.max(Math.floor(options?.sampleSize ?? 30), 1), 200);
  const matches = await fetchServerMatches(sampleSize);

  const templateIds = new Set<string>();
  const requiredAgentIds = new Set<string>();
  const requiredSkillIds = new Set<string>();

  const templateHints = new Map<string, HubEndpointHint | undefined>();
  const agentHints = new Map<string, HubEndpointHint | undefined>();
  const skillHints = new Map<string, HubEndpointHint | undefined>();

  const activeDomain = getActiveAnalysisDomain();
  const activeDomainPack = getInstalledDomainPackManifest(activeDomain.id);
  const activeDomainHubHint = normalizeHubHint(activeDomainPack?.hub);
  const resourceTemplates = normalizeStringArray(activeDomain.resources?.templates);
  const resourceAgents = normalizeStringArray(activeDomain.resources?.agents);
  const resourceSkills = normalizeStringArray(activeDomain.resources?.skills);

  resourceTemplates.forEach((templateId) => {
    templateIds.add(templateId);
    assignHubHint(templateId, activeDomainHubHint, templateHints);
  });
  resourceAgents.forEach((agentId) => {
    requiredAgentIds.add(agentId);
    assignHubHint(agentId, activeDomainHubHint, agentHints);
  });
  resourceSkills.forEach((skillId) => {
    requiredSkillIds.add(skillId);
    assignHubHint(skillId, activeDomainHubHint, skillHints);
  });

  let planningSnapshotCount = 0;

  for (const match of matches) {
    const snapshot = extractPlanningSnapshot(match);
    if (!snapshot) continue;
    planningSnapshotCount += 1;

    if (snapshot.templateId) {
      templateIds.add(snapshot.templateId);
      assignHubHint(snapshot.templateId, snapshot.hub, templateHints);
    }

    snapshot.requiredAgents.forEach((agentId) => {
      requiredAgentIds.add(agentId);
      assignHubHint(agentId, snapshot.hub, agentHints);
    });

    snapshot.requiredSkills.forEach((skillId) => {
      requiredSkillIds.add(skillId);
      assignHubHint(skillId, snapshot.hub, skillHints);
    });
  }

  const syncedTemplates: string[] = [];
  const syncedAgents: string[] = [];
  const syncedSkills: string[] = [];
  const missingTemplates: string[] = [];
  const missingAgents: string[] = [];
  const missingSkills: string[] = [];
  const errors: string[] = [];

  for (const templateId of toSortedArray(templateIds)) {
    const hasTemplateBeforeInstall = hasPlanTemplate(templateId);

    if (!hasTemplateBeforeInstall) {
      try {
        const installed = await installTemplateFromHub(templateId, templateHints.get(templateId));
        if (installed) {
          syncedTemplates.push(templateId);
        }
      } catch (error: any) {
        errors.push(`template:${templateId}: ${error?.message || "unknown error"}`);
      }
    }

    if (!hasPlanTemplate(templateId)) {
      missingTemplates.push(templateId);
      continue;
    }

    const templateRequirements = getTemplateRequirements(templateId);
    templateRequirements.requiredAgents.forEach((agentId) => {
      requiredAgentIds.add(agentId);
      assignHubHint(agentId, templateHints.get(templateId), agentHints);
    });
    templateRequirements.requiredSkills.forEach((skillId) => {
      requiredSkillIds.add(skillId);
      assignHubHint(skillId, templateHints.get(templateId), skillHints);
    });
  }

  for (const agentId of toSortedArray(requiredAgentIds)) {
    const hasAgentBeforeInstall = hasAgent(agentId);

    if (!hasAgentBeforeInstall) {
      try {
        const installed = await installAgentFromHub(agentId, agentHints.get(agentId));
        if (installed) {
          syncedAgents.push(agentId);
        }
      } catch (error: any) {
        errors.push(`agent:${agentId}: ${error?.message || "unknown error"}`);
      }
    }

    if (!hasAgent(agentId)) {
      missingAgents.push(agentId);
    }
  }

  for (const skillId of toSortedArray(requiredSkillIds)) {
    const hasSkillBeforeInstall = hasSkill(skillId);

    if (!hasSkillBeforeInstall) {
      try {
        const installed = await installSkillFromHub(skillId, skillHints.get(skillId));
        if (installed) {
          syncedSkills.push(skillId);
        }
      } catch (error: any) {
        errors.push(`skill:${skillId}: ${error?.message || "unknown error"}`);
      }
    }

    if (!hasSkill(skillId)) {
      missingSkills.push(skillId);
    }
  }

  return {
    sampledMatchCount: matches.length,
    planningSnapshotCount,
    templateIds: toSortedArray(templateIds),
    requiredAgentIds: toSortedArray(requiredAgentIds),
    requiredSkillIds: toSortedArray(requiredSkillIds),
    syncedTemplates,
    syncedAgents,
    syncedSkills,
    missingTemplates,
    missingAgents,
    missingSkills,
    errors,
  };
}
