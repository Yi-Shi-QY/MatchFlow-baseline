import type { Match } from "@/src/data/matches";
import {
  createFootballBuiltinModule,
  footballDomain,
  type BuiltinDomainModule,
  // DOMAIN_MODULE_IMPORT_MARKER
} from "./modules";
import { cloneMatch } from "./modules/shared/cloneMatch";
import type { DomainPlanningStrategy } from "./planning/types";
import type { AnalysisDomain } from "./types";
import { assertBuiltinDomainUiPresenter } from "./ui/presenter";

const LOCAL_DOMAIN_CASE_MINIMUM = 3;
const DOMAIN_ANALYSIS_AGENT_MINIMUM = 3;

const BUILTIN_DOMAIN_MODULES: BuiltinDomainModule[] = [
  createFootballBuiltinModule(LOCAL_DOMAIN_CASE_MINIMUM),
  // DOMAIN_MODULE_REGISTRATION_MARKER
];

export const DEFAULT_DOMAIN_ID = footballDomain.id;

let modulesValidated = false;

function normalizeResourceIds(
  domainId: string,
  resourceName: string,
  ids: string[] | undefined,
): string[] {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error(`Domain ${domainId} must provide non-empty ${resourceName}.`);
  }

  const invalidIds = ids.filter((id) => typeof id !== "string" || id.trim().length === 0);
  if (invalidIds.length > 0) {
    throw new Error(`Domain ${domainId} contains invalid ids in ${resourceName}.`);
  }

  const normalized = ids.map((id) => id.trim());
  const duplicateIds = normalized.filter((id, index) => normalized.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    throw new Error(
      `Domain ${domainId} has duplicated ${resourceName} ids: ${Array.from(new Set(duplicateIds)).join(", ")}`,
    );
  }
  return normalized;
}

function validateDomainResourceContracts(moduleItem: BuiltinDomainModule) {
  const domainId = moduleItem.domain.id;
  const resources = moduleItem.domain.resources;

  if (!resources) {
    throw new Error(`Domain ${domainId} must define resources for templates/animations/agents/skills.`);
  }

  normalizeResourceIds(domainId, "resources.templates", resources.templates);
  normalizeResourceIds(domainId, "resources.animations", resources.animations);
  normalizeResourceIds(domainId, "resources.skills", resources.skills);

  const agentIds = normalizeResourceIds(domainId, "resources.agents", resources.agents);
  const agentIdSet = new Set(agentIds);

  const getPlannerAgentId = moduleItem.planningStrategy.getPlannerAgentId;
  if (typeof getPlannerAgentId !== "function") {
    throw new Error(`Domain ${domainId} must provide planningStrategy.getPlannerAgentId(...)`);
  }

  const plannerAgentIds = [
    getPlannerAgentId("template"),
    getPlannerAgentId("autonomous"),
  ].map((id) => (typeof id === "string" ? id.trim() : ""));

  if (plannerAgentIds.some((id) => id.length === 0)) {
    throw new Error(`Domain ${domainId} planningStrategy.getPlannerAgentId(...) must return non-empty ids.`);
  }

  const missingPlannerAgents = plannerAgentIds.filter((id) => !agentIdSet.has(id));
  if (missingPlannerAgents.length > 0) {
    throw new Error(
      `Domain ${domainId} resources.agents is missing planner agents: ${Array.from(new Set(missingPlannerAgents)).join(", ")}`,
    );
  }

  const plannerAgentSet = new Set(plannerAgentIds);
  const nonPlannerAnalysisAgentCount = agentIds.filter((id) => !plannerAgentSet.has(id)).length;
  if (nonPlannerAnalysisAgentCount < DOMAIN_ANALYSIS_AGENT_MINIMUM) {
    throw new Error(
      `Domain ${domainId} must provide at least ${DOMAIN_ANALYSIS_AGENT_MINIMUM} analysis agents excluding planners, received ${nonPlannerAnalysisAgentCount}.`,
    );
  }

  const requiredTerminalAgentType = moduleItem.planningStrategy.requiredTerminalAgentType?.trim();
  if (requiredTerminalAgentType && !agentIdSet.has(requiredTerminalAgentType)) {
    throw new Error(
      `Domain ${domainId} requiredTerminalAgentType="${requiredTerminalAgentType}" is not registered in resources.agents.`,
    );
  }
}

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

    assertBuiltinDomainUiPresenter(domainId);
    validateDomainResourceContracts(moduleItem);

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
