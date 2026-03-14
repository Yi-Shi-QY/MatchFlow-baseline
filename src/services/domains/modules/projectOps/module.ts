import type { BuiltinDomainModule } from '../types';
import { projectOpsDomain } from './domain';
import { buildProjectOpsLocalCases } from './localCases';
import { projectOpsPlanningStrategy } from './planning';

export function createProjectOpsBuiltinModule(caseMinimum: number): BuiltinDomainModule {
  return {
    domain: projectOpsDomain,
    planningStrategy: projectOpsPlanningStrategy,
    localSubjectSnapshots: buildProjectOpsLocalCases(caseMinimum),
  };
}

export const DOMAIN_MODULE_FACTORIES = [createProjectOpsBuiltinModule];
