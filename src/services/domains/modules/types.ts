import type { Match } from "@/src/data/matches";
import type { DomainPlanningStrategy } from "../planning/types";
import type { AnalysisDomain } from "../types";

export interface BuiltinDomainModule {
  domain: AnalysisDomain;
  planningStrategy: DomainPlanningStrategy;
  localSubjectSnapshots: Match[];
}

export type BuiltinDomainModuleFactory = (caseMinimum: number) => BuiltinDomainModule;
