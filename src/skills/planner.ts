import { FunctionDeclaration, Type } from "@google/genai";
import { 
  basicTemplate, 
  standardTemplate, 
  oddsFocusedTemplate, 
  comprehensiveTemplate 
} from './planner_templates';

export const selectPlanTemplateDeclaration: FunctionDeclaration = {
  name: "select_plan_template",
  description: "Selects a predefined analysis plan template based on the available data richness and user requirements. Use this by default unless the user requests a completely custom analysis structure.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      templateType: {
        type: Type.STRING,
        description: "The type of template to use: 'basic' (only overview and prediction), 'standard' (includes stats and tactics), 'odds_focused' (focuses heavily on betting odds), or 'comprehensive' (all segments).",
      },
      language: {
        type: Type.STRING,
        description: "The language for the segment titles and focus descriptions: 'en' or 'zh'.",
      }
    },
    required: ["templateType", "language"],
  },
};

export async function executeSelectPlanTemplate(args: { templateType: string; language: string }): Promise<any[]> {
  const { templateType, language } = args;
  const isZh = language === 'zh';

  const templates: Record<string, (isZh: boolean) => any[]> = {
    basic: basicTemplate,
    standard: standardTemplate,
    odds_focused: oddsFocusedTemplate,
    comprehensive: comprehensiveTemplate
  };

  const templateFn = templates[templateType] || templates.standard;
  return templateFn(isZh);
}

