import type { BuiltinDomainModule, BuiltinDomainModuleFactory } from "./modules/types";
import type { DomainPlanningStrategy } from "./planning/types";
import type { AnalysisDomain } from "./types";
import { assertBuiltinDomainUiPresenter, assertBuiltinDomainUiTheme } from "./ui/presenter";
import { cloneSubjectSnapshot } from "@/src/services/subjectDisplay";
import type { SubjectDisplay } from "@/src/services/subjectDisplay";

const LOCAL_DOMAIN_CASE_MINIMUM = 3;
const DOMAIN_ANALYSIS_AGENT_MINIMUM = 3;

type DomainModuleFactoryModule = {
  DOMAIN_MODULE_FACTORIES?: BuiltinDomainModuleFactory[];
};

function collectBuiltinDomainModules(caseMinimum: number): BuiltinDomainModule[] {
  const modules = import.meta.glob("./modules/*/module.ts", { eager: true }) as Record<
    string,
    DomainModuleFactoryModule
  >;
  const factories = Object.entries(modules)
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    .flatMap(([_modulePath, module]) =>
      Array.isArray(module.DOMAIN_MODULE_FACTORIES) ? module.DOMAIN_MODULE_FACTORIES : [],
    );
  return factories.map((factory) => factory(caseMinimum));
}

const BUILTIN_DOMAIN_MODULES: BuiltinDomainModule[] =
  collectBuiltinDomainModules(LOCAL_DOMAIN_CASE_MINIMUM);

function resolveDefaultDomainId(modules: BuiltinDomainModule[]): string {
  const footballModule = modules.find((moduleItem) => moduleItem?.domain?.id === "football");
  if (footballModule?.domain?.id) return footballModule.domain.id;
  const first = modules[0]?.domain?.id;
  return typeof first === "string" && first.trim().length > 0 ? first : "football";
}

export const DEFAULT_DOMAIN_ID = resolveDefaultDomainId(BUILTIN_DOMAIN_MODULES);

export interface BuiltinDomainOnboardingCoverage {
  domainId: string;
  hasRuntimePack: boolean;
  hasDetailAdapter: boolean;
  hasAnalysisConfigAdapter: boolean;
  hasAutomationParser: boolean;
  hasContractTests: boolean;
}

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
      throw new Error("Found built-in domain module without domain.id.");
    }
    if (seenDomainIds.has(domainId)) {
      throw new Error(`Duplicate built-in domain id detected: ${domainId}.`);
    }
    seenDomainIds.add(domainId);

    if (!planningDomainId) {
      throw new Error(`Built-in domain ${domainId} is missing planningStrategy.domainId.`);
    }
    if (planningDomainId !== domainId) {
      throw new Error(
        `Built-in domain module mismatch: domain.id=${domainId}, planning.domainId=${planningDomainId}`,
      );
    }

    assertBuiltinDomainUiPresenter(domainId);
    assertBuiltinDomainUiTheme(domainId);
    validateDomainResourceContracts(moduleItem);

    const sourceIds = moduleItem.domain.dataSources
      .map((source) => source?.id)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
    const duplicateSourceIds = sourceIds.filter((id, index) => sourceIds.indexOf(id) !== index);
    if (duplicateSourceIds.length > 0) {
      throw new Error(
        `Domain ${domainId} contains duplicated data source ids: ${Array.from(new Set(duplicateSourceIds)).join(", ")}`,
      );
    }

    const caseCount = Array.isArray(moduleItem.localSubjectSnapshots)
      ? moduleItem.localSubjectSnapshots.length
      : 0;
    if (caseCount < LOCAL_DOMAIN_CASE_MINIMUM) {
      throw new Error(
        `Domain ${domainId} must provide at least ${LOCAL_DOMAIN_CASE_MINIMUM} local subject snapshots, received ${caseCount}.`,
      );
    }

    const caseIds = moduleItem.localSubjectSnapshots
      .map((match) => (typeof match?.id === "string" ? match.id.trim() : ""))
      .filter((id) => id.length > 0);
    if (caseIds.length < LOCAL_DOMAIN_CASE_MINIMUM) {
      throw new Error(
        `Domain ${domainId} has invalid local subject snapshots: at least ${LOCAL_DOMAIN_CASE_MINIMUM} non-empty subject ids are required.`,
      );
    }

    const duplicateCaseIds = caseIds.filter((id, index) => caseIds.indexOf(id) !== index);
    if (duplicateCaseIds.length > 0) {
      throw new Error(
        `Domain ${domainId} local subject ids must be unique. Duplicates: ${Array.from(new Set(duplicateCaseIds)).join(", ")}`,
      );
    }
  });
}

export function listBuiltinDomainModules(): BuiltinDomainModule[] {
  validateBuiltinModules();
  return BUILTIN_DOMAIN_MODULES;
}

export function listBuiltinDomainIds(): string[] {
  return listBuiltinDomainModules().map((moduleItem) => moduleItem.domain.id);
}

export function listBuiltinDomains(): AnalysisDomain[] {
  return listBuiltinDomainModules().map((moduleItem) => moduleItem.domain);
}

export function listBuiltinPlanningStrategies(): DomainPlanningStrategy[] {
  return listBuiltinDomainModules().map((moduleItem) => moduleItem.planningStrategy);
}

export function getBuiltinDomainLocalSubjectSnapshots<T extends SubjectDisplay = SubjectDisplay>(
  domainId: string,
): T[] {
  const moduleItem = listBuiltinDomainModules().find((item) => item.domain.id === domainId);
  if (!moduleItem) return [];
  return moduleItem.localSubjectSnapshots.map((snapshot) => cloneSubjectSnapshot(snapshot) as T);
}

export function findBuiltinDomainLocalSubjectSnapshotById<T extends SubjectDisplay = SubjectDisplay>(input: {
  subjectId: string;
  domainId?: string;
}): T | null {
  const subjectId = typeof input.subjectId === 'string' ? input.subjectId.trim() : '';
  if (!subjectId) return null;
  const modules = input.domainId
    ? listBuiltinDomainModules().filter((moduleItem) => moduleItem.domain.id === input.domainId)
    : listBuiltinDomainModules();
  for (const moduleItem of modules) {
    const found = moduleItem.localSubjectSnapshots.find((match) => match?.id === subjectId);
    if (found) return cloneSubjectSnapshot(found) as T;
  }
  return null;
}

export function validateBuiltinDomainOnboardingCoverage(
  checks: BuiltinDomainOnboardingCoverage[],
): void {
  const expectedDomainIds = new Set(listBuiltinDomainIds());
  const coverageByDomainId = new Map(
    checks.map((check) => [check.domainId, check] satisfies [string, BuiltinDomainOnboardingCoverage]),
  );

  expectedDomainIds.forEach((domainId) => {
    const coverage = coverageByDomainId.get(domainId);
    if (!coverage) {
      throw new Error(`Built-in domain ${domainId} is missing onboarding coverage metadata.`);
    }

    const missingCapabilities = [
      coverage.hasRuntimePack ? null : 'runtime pack',
      coverage.hasDetailAdapter ? null : 'detail adapter',
      coverage.hasAnalysisConfigAdapter ? null : 'analysis config adapter',
      coverage.hasAutomationParser ? null : 'automation parser',
      coverage.hasContractTests ? null : 'contract tests',
    ].filter((value): value is string => Boolean(value));

    if (missingCapabilities.length > 0) {
      throw new Error(
        `Built-in domain ${domainId} is missing onboarding requirements: ${missingCapabilities.join(', ')}.`,
      );
    }
  });
}
