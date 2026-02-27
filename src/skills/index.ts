import { calculatorDeclaration, executeCalculator } from "./calculator";

export const availableSkills = [calculatorDeclaration];

export async function executeSkill(name: string, args: any): Promise<any> {
  switch (name) {
    case "calculator":
      return await executeCalculator(args);
    default:
      throw new Error(`Unknown skill: ${name}`);
  }
}
