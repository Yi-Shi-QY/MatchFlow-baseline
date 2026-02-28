import { calculatorSkill } from "./calculator";
import { plannerSkill } from "./planner";
import { AgentSkill } from "./types";

export const availableSkills: AgentSkill[] = [calculatorSkill, plannerSkill];

export async function executeSkill(toolName: string, args: any): Promise<any> {
  for (const skill of availableSkills) {
    if (skill.tools?.some(t => t.name === toolName)) {
      if (skill.execute) {
        return await skill.execute(toolName, args);
      }
    }
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
