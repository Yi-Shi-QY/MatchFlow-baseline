import type { BuiltinDomainModule } from "../types";
import { stocksDomain } from "./domain";
import { buildStocksLocalCases } from "./localCases";
import { stocksPlanningStrategy } from "./planning";

export function createStocksBuiltinModule(caseMinimum: number): BuiltinDomainModule {
  return {
    domain: stocksDomain,
    planningStrategy: stocksPlanningStrategy,
    localTestCases: buildStocksLocalCases(caseMinimum),
  };
}

