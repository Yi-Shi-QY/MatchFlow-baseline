import type { BuiltinDomainModule } from "../types";
import { fengshuiDomain } from "./domain";
import { buildFengshuiLocalCases } from "./localCases";
import { fengshuiPlanningStrategy } from "./planning";

export function createFengshuiBuiltinModule(caseMinimum: number): BuiltinDomainModule {
  return {
    domain: fengshuiDomain,
    planningStrategy: fengshuiPlanningStrategy,
    localTestCases: buildFengshuiLocalCases(caseMinimum),
  };
}

export const DOMAIN_MODULE_FACTORIES = [createFengshuiBuiltinModule];
