import { FunctionDeclaration, Type } from "@google/genai";
import { PlanTemplate } from "./types";
import { listInstalledTemplateManifests } from "@/src/services/extensions/store";
import { TemplateExtensionManifest } from "@/src/services/extensions/types";

type DomainTemplateModule = {
  DOMAIN_TEMPLATE_ENTRIES?: PlanTemplate[];
};

function collectBuiltinTemplates(): PlanTemplate[] {
  const modules = import.meta.glob("./templates/*/index.ts", { eager: true }) as Record<
    string,
    DomainTemplateModule
  >;
  const discovered = Object.values(modules).flatMap((module) =>
    Array.isArray(module.DOMAIN_TEMPLATE_ENTRIES) ? module.DOMAIN_TEMPLATE_ENTRIES : [],
  );
  const seen = new Set<string>();
  return discovered.filter((template) => {
    const id = typeof template?.id === "string" ? template.id.trim() : "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const BUILTIN_TEMPLATES: PlanTemplate[] = collectBuiltinTemplates();

function manifestToTemplate(manifest: TemplateExtensionManifest): PlanTemplate {
  return {
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
    rule: manifest.rule,
    requiredAgents: manifest.requiredAgents || [],
    requiredSkills: manifest.requiredSkills || [],
    getSegments: (isZh: boolean) =>
      manifest.segments.map((segment) => ({
        title: isZh ? segment.title.zh : segment.title.en,
        focus: isZh ? segment.focus.zh : segment.focus.en,
        animationType: segment.animationType || "none",
        agentType: segment.agentType || "general",
        contextMode: segment.contextMode || "build_upon",
        sourceIds: Array.isArray(segment.sourceIds)
          ? segment.sourceIds
              .map((sourceId) =>
                typeof sourceId === "string" ? sourceId.trim() : "",
              )
              .filter((sourceId) => sourceId.length > 0)
          : [],
      })),
  };
}

export function listPlanTemplates(): PlanTemplate[] {
  const installed = listInstalledTemplateManifests().map(manifestToTemplate);
  const merged = [...BUILTIN_TEMPLATES];
  const seen = new Set(merged.map((template) => template.id));

  installed.forEach((template) => {
    if (seen.has(template.id)) return;
    merged.push(template);
    seen.add(template.id);
  });

  return merged;
}

export function getPlanTemplateById(id: string): PlanTemplate | null {
  const templates = listPlanTemplates();
  return templates.find((template) => template.id === id) || null;
}

export function hasPlanTemplate(id: string): boolean {
  return !!getPlanTemplateById(id);
}

function getDefaultTemplate(): PlanTemplate {
  const preferred =
    BUILTIN_TEMPLATES.find((template) => template.id === "standard") || BUILTIN_TEMPLATES[0];
  if (!preferred) {
    throw new Error("No built-in plan templates discovered under skills/planner/templates.");
  }
  return preferred;
}

export function getTemplateRequirements(templateId: string): {
  requiredAgents: string[];
  requiredSkills: string[];
} {
  const template = getPlanTemplateById(templateId);
  if (!template) {
    return { requiredAgents: [], requiredSkills: [] };
  }

  const segmentAgents = template
    .getSegments(false)
    .map((segment) => segment?.agentType || "general")
    .filter((agentId) => typeof agentId === "string" && agentId.trim().length > 0);

  const requiredAgents = Array.from(
    new Set([...(template.requiredAgents || []), ...segmentAgents]),
  );

  return {
    requiredAgents,
    requiredSkills: Array.from(new Set(template.requiredSkills || [])),
  };
}

const templateDescriptions = BUILTIN_TEMPLATES
  .map((template) => `- ${template.id}: ${template.description} (${template.rule})`)
  .join("\n");

export const selectPlanTemplateDeclaration: FunctionDeclaration = {
  name: "select_plan_template",
  description: `Selects an analysis plan template based on data richness and user requirements. Use this by default unless the user requests a fully custom structure. Built-in templates:\n${templateDescriptions}\nAlso supports hub-installed templates by id.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      templateType: {
        type: Type.STRING,
        description: `Template id to use. Built-ins: ${BUILTIN_TEMPLATES.map((template) => template.id).join(", ")}. Hub-installed template ids are also accepted.`,
      },
      language: {
        type: Type.STRING,
        description: "The language for the segment titles and focus descriptions: 'en' or 'zh'.",
      },
      includeAnimations: {
        type: Type.BOOLEAN,
        description: "Whether to include animations in the plan. If true, appropriate segments will have animationType set. If false, all will be 'none'.",
      }
    },
    required: ["templateType", "language", "includeAnimations"],
  },
};

export async function executeSelectPlanTemplate(args: { templateType: string; language: string; includeAnimations: boolean }): Promise<any[]> {
  const { templateType, language, includeAnimations } = args;
  const isZh = language === 'zh';

  const template = getPlanTemplateById(templateType) || getDefaultTemplate();
  const segments = template.getSegments(isZh);

  if (!includeAnimations) {
    return segments.map(s => ({ ...s, animationType: 'none' }));
  }

  return segments;
}
