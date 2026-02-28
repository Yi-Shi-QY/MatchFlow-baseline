import { calculatorDeclaration, executeCalculator } from "./calculator";
import { selectPlanTemplateDeclaration, executeSelectPlanTemplate } from "./planner";

export const availableSkills = [calculatorDeclaration, selectPlanTemplateDeclaration];

export async function executeSkill(name: string, args: any): Promise<any> {
  switch (name) {
    case "calculator":
      return await executeCalculator(args);
    case "select_plan_template":
      return await executeSelectPlanTemplate(args);
    default:
      throw new Error(`Unknown skill: ${name}`);
  }
}
