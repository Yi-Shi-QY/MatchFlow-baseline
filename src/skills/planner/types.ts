export interface PlanTemplate {
  id: string;
  version?: string;
  name: string;
  description: string;
  rule: string;
  requiredAgents?: string[];
  requiredSkills?: string[];
  getSegments: (isZh: boolean) => any[];
}
