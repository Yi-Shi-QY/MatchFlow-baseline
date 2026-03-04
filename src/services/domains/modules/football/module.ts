import type { BuiltinDomainModule } from "../types";
import { footballDomain } from "./domain";
import { buildFootballLocalCases } from "./localCases";
import { footballPlanningStrategy } from "./planning";

export function createFootballBuiltinModule(caseMinimum: number): BuiltinDomainModule {
  return {
    domain: footballDomain,
    planningStrategy: footballPlanningStrategy,
    localTestCases: buildFootballLocalCases(caseMinimum),
  };
}

export const DOMAIN_MODULE_FACTORIES = [createFootballBuiltinModule];
