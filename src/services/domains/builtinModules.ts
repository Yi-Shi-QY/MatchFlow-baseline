import type { Match } from "@/src/data/matches";
import {
  createFootballBuiltinModule,
  footballDomain,
  type BuiltinDomainModule,
} from "./modules";
import { cloneMatch } from "./modules/shared/cloneMatch";
import type { DomainPlanningStrategy } from "./planning/types";
import type { AnalysisDomain } from "./types";

const LOCAL_DOMAIN_CASE_MINIMUM = 3;

const BUILTIN_DOMAIN_MODULES: BuiltinDomainModule[] = [
  createFootballBuiltinModule(LOCAL_DOMAIN_CASE_MINIMUM),
];

export const DEFAULT_DOMAIN_ID = footballDomain.id;

let modulesValidated = false;

function validateBuiltinModules() {
  if (modulesValidated) return;
  modulesValidated = true;

  const seenDomainIds = new Set<string>();

  BUILTIN_DOMAIN_MODULES.forEach((moduleItem) => {
    const domainId = moduleItem?.domain?.id;
    const planningDomainId = moduleItem?.planningStrategy?.domainId;

    if (!domainId) {
      console.warn("Found built-in domain module without domain.id");
      return;
    }
    if (seenDomainIds.has(domainId)) {
      console.warn(`Duplicate built-in domain id detected: ${domainId}`);
      return;
    }
    seenDomainIds.add(domainId);

    if (!planningDomainId) {
      console.warn(`Built-in domain ${domainId} is missing planningStrategy.domainId`);
      return;
    }
    if (planningDomainId !== domainId) {
      console.warn(
        `Built-in domain module mismatch: domain.id=${domainId}, planning.domainId=${planningDomainId}`,
      );
    }

    const sourceIds = moduleItem.domain.dataSources
      .map((source) => source?.id)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
    const duplicateSourceIds = sourceIds.filter((id, index) => sourceIds.indexOf(id) !== index);
    if (duplicateSourceIds.length > 0) {
      console.warn(
        `Domain ${domainId} contains duplicated data source ids: ${Array.from(new Set(duplicateSourceIds)).join(", ")}`,
      );
    }

    const caseCount = Array.isArray(moduleItem.localTestCases)
      ? moduleItem.localTestCases.length
      : 0;
    if (caseCount < LOCAL_DOMAIN_CASE_MINIMUM) {
      throw new Error(
        `Domain ${domainId} must provide at least ${LOCAL_DOMAIN_CASE_MINIMUM} local test cases, received ${caseCount}.`,
      );
    }

    const caseIds = moduleItem.localTestCases
      .map((match) => (typeof match?.id === "string" ? match.id.trim() : ""))
      .filter((id) => id.length > 0);
    if (caseIds.length < LOCAL_DOMAIN_CASE_MINIMUM) {
      throw new Error(
        `Domain ${domainId} has invalid local test cases: at least ${LOCAL_DOMAIN_CASE_MINIMUM} non-empty case ids are required.`,
      );
    }

    const duplicateCaseIds = caseIds.filter((id, index) => caseIds.indexOf(id) !== index);
    if (duplicateCaseIds.length > 0) {
      throw new Error(
        `Domain ${domainId} local test case ids must be unique. Duplicates: ${Array.from(new Set(duplicateCaseIds)).join(", ")}`,
      );
    }
  });
}

export function listBuiltinDomainModules(): BuiltinDomainModule[] {
  validateBuiltinModules();
  return BUILTIN_DOMAIN_MODULES;
}

export function listBuiltinDomains(): AnalysisDomain[] {
  return listBuiltinDomainModules().map((moduleItem) => moduleItem.domain);
}

export function listBuiltinPlanningStrategies(): DomainPlanningStrategy[] {
  return listBuiltinDomainModules().map((moduleItem) => moduleItem.planningStrategy);
}

export function getBuiltinDomainLocalTestCases(domainId: string): Match[] {
  const moduleItem = listBuiltinDomainModules().find((item) => item.domain.id === domainId);
  if (!moduleItem) return [];
  return moduleItem.localTestCases.map(cloneMatch);
}

export function findBuiltinDomainLocalTestCaseById(matchId: string): Match | null {
  if (!matchId) return null;
  for (const moduleItem of listBuiltinDomainModules()) {
    const found = moduleItem.localTestCases.find((match) => match?.id === matchId);
    if (found) return cloneMatch(found);
  }
  return null;
}
