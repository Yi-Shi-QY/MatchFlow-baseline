import { FunctionDeclaration, Type } from "@google/genai";
import { basicTemplate } from "./templates/basic";
import { standardTemplate } from "./templates/standard";
import { oddsFocusedTemplate } from "./templates/odds_focused";
import { comprehensiveTemplate } from "./templates/comprehensive";
import { PlanTemplate } from "./types";

const templates: PlanTemplate[] = [
  basicTemplate,
  standardTemplate,
  oddsFocusedTemplate,
  comprehensiveTemplate
];

const templateDescriptions = templates.map(t => `- ${t.id}: ${t.description} (${t.rule})`).join('\n');

export const selectPlanTemplateDeclaration: FunctionDeclaration = {
  name: "select_plan_template",
  description: `Selects a predefined analysis plan template based on the available data richness and user requirements. Use this by default unless the user requests a completely custom analysis structure. Available templates:\n${templateDescriptions}`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      templateType: {
        type: Type.STRING,
        description: `The type of template to use. Must be one of: ${templates.map(t => t.id).join(', ')}.`,
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

  const template = templates.find(t => t.id === templateType) || standardTemplate;
  const segments = template.getSegments(isZh);

  if (!includeAnimations) {
    return segments.map(s => ({ ...s, animationType: 'none' }));
  }

  return segments;
}
