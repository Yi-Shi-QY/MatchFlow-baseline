import { calculatorDeclaration, executeCalculator } from "./calculator";
import { selectPlanTemplateDeclaration, executeSelectPlanTemplate } from "./planner";
import { FunctionDeclaration } from "@google/genai";
import { getInstalledSkillManifest, listInstalledSkillManifests } from "@/src/services/extensions/store";

const BUILTIN_SKILL_DECLARATIONS: Record<string, FunctionDeclaration> = {
  calculator: calculatorDeclaration,
  select_plan_template: selectPlanTemplateDeclaration,
};

export const BUILTIN_SKILL_VERSIONS: Record<string, string> = {
  calculator: "1.0.0",
  select_plan_template: "1.0.0",
};

function getDynamicSkillDeclarations(): FunctionDeclaration[] {
  return listInstalledSkillManifests().map((manifest) => manifest.declaration);
}

export function getAvailableSkills(): FunctionDeclaration[] {
  const declarations = Object.values(BUILTIN_SKILL_DECLARATIONS);
  const installed = getDynamicSkillDeclarations();
  const map = new Map<string, FunctionDeclaration>();

  declarations.forEach((decl) => {
    if (decl?.name) map.set(decl.name, decl);
  });
  installed.forEach((decl) => {
    if (decl?.name) map.set(decl.name, decl);
  });

  return Array.from(map.values());
}

export const availableSkills = getAvailableSkills();

function resolveRuntimeSkillName(skillName: string): string {
  if (BUILTIN_SKILL_DECLARATIONS[skillName]) return skillName;

  const installed = getInstalledSkillManifest(skillName);
  if (installed?.runtime?.mode === "builtin_alias") {
    return installed.runtime.targetSkill;
  }

  return skillName;
}

export function hasSkill(skillName: string): boolean {
  if (BUILTIN_SKILL_DECLARATIONS[skillName]) return true;
  return !!getInstalledSkillManifest(skillName);
}

export function getSkillVersion(skillName: string): string | null {
  if (BUILTIN_SKILL_DECLARATIONS[skillName]) {
    return BUILTIN_SKILL_VERSIONS[skillName] || "1.0.0";
  }
  return getInstalledSkillManifest(skillName)?.version || null;
}

export async function executeSkill(name: string, args: any): Promise<any> {
  const runtimeName = resolveRuntimeSkillName(name);

  switch (runtimeName) {
    case "calculator":
      return await executeCalculator(args);
    case "select_plan_template":
      return await executeSelectPlanTemplate(args);
    default:
      throw new Error(`Unknown skill: ${name} (runtime: ${runtimeName})`);
  }
}
