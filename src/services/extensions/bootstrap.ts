import { BUILTIN_AGENTS, BUILTIN_AGENT_VERSIONS } from "@/src/agents";
import { BUILTIN_SKILL_VERSIONS, getAvailableSkills } from "@/src/skills";
import { listPlanTemplates } from "@/src/skills/planner";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function validateVersionMap(
  ids: string[],
  versionMap: Record<string, string>,
  label: string,
  issues: string[],
) {
  ids.forEach((id) => {
    const version = versionMap[id];
    if (!version) {
      issues.push(`${label} "${id}" missing version`);
      return;
    }
    if (!SEMVER_PATTERN.test(version)) {
      issues.push(`${label} "${id}" has invalid semver "${version}"`);
    }
  });
}

export function validateBuiltInExtensionRegistry(): string[] {
  const issues: string[] = [];

  const agentIds = Object.keys(BUILTIN_AGENTS);
  if (agentIds.length === 0) {
    issues.push("No built-in agents registered.");
  }
  validateVersionMap(agentIds, BUILTIN_AGENT_VERSIONS, "Agent", issues);

  const skills = getAvailableSkills();
  const skillNames = skills.map((skill) => skill.name).filter(Boolean);
  const duplicateSkills = skillNames.filter((name, idx) => skillNames.indexOf(name) !== idx);
  if (duplicateSkills.length > 0) {
    issues.push(`Duplicate skill declarations found: ${Array.from(new Set(duplicateSkills)).join(", ")}`);
  }
  const builtInSkillIds = Object.keys(BUILTIN_SKILL_VERSIONS);
  builtInSkillIds.forEach((skillId) => {
    if (!skillNames.includes(skillId)) {
      issues.push(`Built-in skill "${skillId}" declaration is missing from registry.`);
    }
  });
  validateVersionMap(
    builtInSkillIds,
    BUILTIN_SKILL_VERSIONS,
    "Skill",
    issues,
  );

  const templateIds = listPlanTemplates().map((template) => template.id);
  const duplicateTemplates = templateIds.filter(
    (id, idx) => templateIds.indexOf(id) !== idx,
  );
  if (duplicateTemplates.length > 0) {
    issues.push(`Duplicate plan templates found: ${Array.from(new Set(duplicateTemplates)).join(", ")}`);
  }

  return issues;
}

export function bootstrapExtensionRegistryValidation() {
  const issues = validateBuiltInExtensionRegistry();
  if (issues.length > 0) {
    console.warn("[ExtensionRegistry] Validation issues detected:");
    issues.forEach((issue) => console.warn(`[ExtensionRegistry] ${issue}`));
  } else {
    console.info("[ExtensionRegistry] Built-in agent/skill/template registries validated.");
  }
}
