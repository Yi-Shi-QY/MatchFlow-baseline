import type { HubEndpointHint } from "@/src/services/extensions/types";

export interface PlanningRouteDecision {
  mode: "template" | "autonomous";
  templateType?: string;
  allowedAgentTypes: string[] | null;
  reason: string;
  requiredAgentIds?: string[];
  requiredSkillIds?: string[];
  hub?: HubEndpointHint;
}

export interface DomainPlanningStrategy {
  domainId: string;
  resolveRoute: (analysisData: any) => PlanningRouteDecision;
  buildFallbackPlan: (language: "en" | "zh") => any[];
  requiredTerminalAgentType?: string;
  buildRequiredTerminalSegment?: (language: "en" | "zh") => any;
}
