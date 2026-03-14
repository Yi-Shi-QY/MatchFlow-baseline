import type { SubjectDisplay } from "@/src/services/subjectDisplay";
import type { DomainPlanningStrategy } from "../planning/types";
import type { AnalysisDomain } from "../types";

export interface BuiltinDomainModule {
  domain: AnalysisDomain;
  planningStrategy: DomainPlanningStrategy;
  localSubjectSnapshots: SubjectDisplay[];
}

export type BuiltinDomainModuleFactory = (caseMinimum: number) => BuiltinDomainModule;
