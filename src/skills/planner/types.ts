export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  rule: string;
  getSegments: (isZh: boolean) => any[];
}
