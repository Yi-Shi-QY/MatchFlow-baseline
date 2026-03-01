import { hasAgent } from "@/src/agents";
import { hasSkill } from "@/src/skills";
import { getTemplateRequirements, hasPlanTemplate } from "@/src/skills/planner";
import { installAgentFromHub, installSkillFromHub, installTemplateFromHub } from "./hub";
import { HubEndpointHint } from "./types";

export interface EnsureRequirementsResult {
  ok: boolean;
  installedAgents: string[];
  installedSkills: string[];
  installedTemplates: string[];
  missingAgents: string[];
  missingSkills: string[];
  missingTemplates: string[];
}

function emptyEnsureResult(): EnsureRequirementsResult {
  return {
    ok: true,
    installedAgents: [],
    installedSkills: [],
    installedTemplates: [],
    missingAgents: [],
    missingSkills: [],
    missingTemplates: [],
  };
}

export async function ensureAgentAvailable(
  agentId: string,
  hubHint?: HubEndpointHint,
): Promise<boolean> {
  if (!agentId) return false;
  if (hasAgent(agentId)) return true;
  const installed = await installAgentFromHub(agentId, hubHint);
  return !!installed && hasAgent(agentId);
}

export async function ensureSkillAvailable(
  skillId: string,
  hubHint?: HubEndpointHint,
): Promise<boolean> {
  if (!skillId) return false;
  if (hasSkill(skillId)) return true;
  const installed = await installSkillFromHub(skillId, hubHint);
  return !!installed && hasSkill(skillId);
}

export async function ensureTemplateAvailable(
  templateId: string,
  hubHint?: HubEndpointHint,
): Promise<boolean> {
  if (!templateId) return false;
  if (hasPlanTemplate(templateId)) return true;
  const installed = await installTemplateFromHub(templateId, hubHint);
  return !!installed && hasPlanTemplate(templateId);
}

export async function ensureTemplateRequirements(
  templateId: string,
  hubHint?: HubEndpointHint,
): Promise<EnsureRequirementsResult> {
  const result = emptyEnsureResult();

  const alreadyHasTemplate = hasPlanTemplate(templateId);
  const hasTemplate = await ensureTemplateAvailable(templateId, hubHint);
  if (!hasTemplate) {
    result.ok = false;
    result.missingTemplates.push(templateId);
    return result;
  }
  if (!alreadyHasTemplate) {
    result.installedTemplates.push(templateId);
  }

  const requirements = getTemplateRequirements(templateId);

  for (const agentId of requirements.requiredAgents) {
    if (!hasAgent(agentId)) {
      const installed = await installAgentFromHub(agentId, hubHint);
      if (installed && hasAgent(agentId)) {
        result.installedAgents.push(agentId);
      } else {
        result.ok = false;
        result.missingAgents.push(agentId);
      }
    }
  }

  for (const skillId of requirements.requiredSkills) {
    if (!hasSkill(skillId)) {
      const installed = await installSkillFromHub(skillId, hubHint);
      if (installed && hasSkill(skillId)) {
        result.installedSkills.push(skillId);
      } else {
        result.ok = false;
        result.missingSkills.push(skillId);
      }
    }
  }

  if (!result.ok) {
    return result;
  }

  if (!hasPlanTemplate(templateId)) {
    result.ok = false;
    result.missingTemplates.push(templateId);
  }

  return result;
}

export async function ensurePlanAgentRequirements(
  plan: any[],
  hubHint?: HubEndpointHint,
): Promise<EnsureRequirementsResult> {
  const result = emptyEnsureResult();
  const requiredAgents = Array.from(
    new Set(
      (Array.isArray(plan) ? plan : [])
        .map((segment) => segment?.agentType || "general")
        .filter((agentId) => typeof agentId === "string" && agentId.trim().length > 0),
    ),
  );

  for (const agentId of requiredAgents) {
    if (hasAgent(agentId)) continue;
    const installed = await installAgentFromHub(agentId, hubHint);
    if (installed && hasAgent(agentId)) {
      result.installedAgents.push(agentId);
    } else {
      result.ok = false;
      result.missingAgents.push(agentId);
    }
  }

  return result;
}
