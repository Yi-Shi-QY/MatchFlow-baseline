import {
  executeSelectPlanTemplate,
  selectPlanTemplateDeclaration,
} from "./planner";
import type { BuiltinSkillEntry } from "../types";

export const BUILTIN_SKILL_ENTRIES: BuiltinSkillEntry[] = [
  {
    id: "select_plan_template",
    declaration: selectPlanTemplateDeclaration,
    execute: executeSelectPlanTemplate,
    version: "1.0.0",
  },
];
