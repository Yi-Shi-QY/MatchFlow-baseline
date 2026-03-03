import type { BuiltinDomainModule } from "../types";
import { basketballDomain } from "./domain";
import { buildBasketballLocalCases } from "./localCases";
import { basketballPlanningStrategy } from "./planning";

export function createBasketballBuiltinModule(
  _caseMinimum: number,
): BuiltinDomainModule {
  return {
    domain: basketballDomain,
    planningStrategy: basketballPlanningStrategy,
    localTestCases: buildBasketballLocalCases(),
  };
}

