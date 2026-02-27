import { FunctionDeclaration } from "@google/genai";

export interface AgentSkill {
  /** A short identifier for the skill */
  name: string;
  /** A description of what this skill does and when to use it */
  description: string;
  /** The markdown content representing the SKILL.md instructions */
  instructions: string;
  /** Optional executable tools associated with this skill */
  tools?: FunctionDeclaration[];
  /** Function to execute the tools */
  execute?: (toolName: string, args: any) => Promise<any>;
}
