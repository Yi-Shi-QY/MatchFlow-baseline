import { FunctionDeclaration, Type } from "@google/genai";
import { 
  oddsAnimationTemplate, 
  statsAnimationTemplate, 
  tacticalAnimationTemplate, 
  comparisonAnimationTemplate 
} from './animation_templates';

export const getAnimationTemplateDeclaration: FunctionDeclaration = {
  name: "get_animation_template",
  description: "Gets the JSON schema template for a specific type of animation. Use this to know how to format the <animation> block.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      animationType: {
        type: Type.STRING,
        description: "The type of animation template to get: 'odds', 'stats', 'tactical', or 'comparison'.",
      },
      title: {
        type: Type.STRING,
        description: "The title of the animation segment.",
      },
      homeName: {
        type: Type.STRING,
        description: "The name of the home team.",
      },
      awayName: {
        type: Type.STRING,
        description: "The name of the away team.",
      }
    },
    required: ["animationType", "title", "homeName", "awayName"],
  },
};

export async function executeGetAnimationTemplate(args: { animationType: string; title: string; homeName: string; awayName: string }): Promise<string> {
  const { animationType, title, homeName, awayName } = args;

  const templates: Record<string, (title: string, homeName: string, awayName: string) => string> = {
    odds: oddsAnimationTemplate,
    stats: statsAnimationTemplate,
    tactical: tacticalAnimationTemplate,
    comparison: comparisonAnimationTemplate
  };

  const templateFn = templates[animationType];
  if (!templateFn) {
    return `Error: Unknown animation type '${animationType}'. Available types: odds, stats, tactical, comparison.`;
  }

  return templateFn(title, homeName, awayName);
}
