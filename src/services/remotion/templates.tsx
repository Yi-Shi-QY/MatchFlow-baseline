import type { AnimationTemplate } from "./templates/types";

type AnimationTemplateModule = {
  ANIMATION_TEMPLATE_ENTRIES?: AnimationTemplate[];
};

function collectAnimationTemplates(): Record<string, AnimationTemplate> {
  const modules = import.meta.glob("./templates/modules/**/*.tsx", {
    eager: true,
  }) as Record<string, AnimationTemplateModule>;

  const entries = Object.entries(modules)
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    .flatMap(([modulePath, module]) => {
      const templateEntries = Array.isArray(module.ANIMATION_TEMPLATE_ENTRIES)
        ? module.ANIMATION_TEMPLATE_ENTRIES
        : [];
      return templateEntries.map((template) => ({ template, modulePath }));
    });

  const templateMap: Record<string, AnimationTemplate> = {};
  const sourceById: Record<string, string> = {};
  entries.forEach(({ template, modulePath }) => {
    if (!template || typeof template.id !== "string" || template.id.trim().length === 0) {
      return;
    }
    const templateId = template.id.trim();
    if (templateMap[templateId]) {
      throw new Error(
        `[remotion] Duplicate animation template id "${templateId}" in ${modulePath}. ` +
          `Already registered in ${sourceById[templateId]}.`,
      );
    }
    templateMap[templateId] = template;
    sourceById[templateId] = modulePath;
  });

  return templateMap;
}

export const TEMPLATES: Record<string, AnimationTemplate> = collectAnimationTemplates();

export type { AnimationTemplate } from "./templates/types";
