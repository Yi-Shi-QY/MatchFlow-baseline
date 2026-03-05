import type { AnimationTemplate } from "./templates/types";

type AnimationTemplateModule = {
  ANIMATION_TEMPLATE_ENTRIES?: AnimationTemplate[];
};

function collectAnimationTemplates(): Record<string, AnimationTemplate> {
  const modules = import.meta.glob("./templates/modules/**/*.tsx", {
    eager: true,
  }) as Record<string, AnimationTemplateModule>;

  const entries = Object.values(modules).flatMap((module) =>
    Array.isArray(module.ANIMATION_TEMPLATE_ENTRIES) ? module.ANIMATION_TEMPLATE_ENTRIES : [],
  );

  const templateMap: Record<string, AnimationTemplate> = {};
  entries.forEach((template) => {
    if (!template || typeof template.id !== "string" || template.id.trim().length === 0) {
      return;
    }
    const templateId = template.id.trim();
    if (templateMap[templateId]) {
      console.warn(`[remotion] Duplicate animation template id detected: ${templateId}`);
      return;
    }
    templateMap[templateId] = template;
  });

  return templateMap;
}

export const TEMPLATES: Record<string, AnimationTemplate> = collectAnimationTemplates();

export type { AnimationTemplate } from "./templates/types";
