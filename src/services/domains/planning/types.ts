import type { HubEndpointHint } from "@/src/services/extensions/types";

export interface PlanningRouteDecision {
  mode: "template" | "autonomous";
  templateType?: string;
  plannerAgentId?: string;
  allowedAgentTypes: string[] | null;
  allowedAnimationTypes?: string[] | null;
  allowedSourceIds?: string[];
  reason: string;
  requiredAgentIds?: string[];
  requiredSkillIds?: string[];
  hub?: HubEndpointHint;
}

export interface DomainPlanningStrategy {
  domainId: string;
  resolveRoute: (analysisData: any) => PlanningRouteDecision;
  getPlannerAgentId?: (mode: "template" | "autonomous") => string;
  buildFallbackPlan: (language: "en" | "zh") => any[];
  requiredTerminalAgentType?: string;
  buildRequiredTerminalSegment?: (language: "en" | "zh") => any;
}
