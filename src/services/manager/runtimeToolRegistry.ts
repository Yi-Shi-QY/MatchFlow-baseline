import {
  getDefaultRuntimeDomainPack,
  getRuntimeDomainPackById,
  listRuntimeDomainPacks,
} from '@/src/domains/runtime/registry';
import type { BuiltinSkillEntry } from '@/src/skills/types';
import {
  executeManagerContinueTaskIntake,
  executeManagerDescribeCapability,
  executeManagerHelp,
  executeManagerPrepareTaskIntake,
  executeManagerQueryLocalMatches,
  managerContinueTaskIntakeDeclaration,
  managerDescribeCapabilityDeclaration,
  managerHelpDeclaration,
  managerPrepareTaskIntakeDeclaration,
  managerQueryLocalMatchesDeclaration,
  type ManagerToolRuntimeSupport,
} from './toolRegistry';

function buildRuntimeSupport(domainId?: string | null): ManagerToolRuntimeSupport | null {
  const runtimePack =
    getRuntimeDomainPackById(domainId) ||
    (domainId ? null : getDefaultRuntimeDomainPack());
  if (!runtimePack?.manager) {
    return null;
  }

  return {
    domainId: runtimePack.manifest.domainId,
    skillIds: runtimePack.manager.skillIds,
    taskIntake: runtimePack.manager.taskIntake || null,
    plannerHints: runtimePack.manager.plannerHints,
  };
}

function resolveRuntimeSupport(domainId: string): ManagerToolRuntimeSupport | null {
  return buildRuntimeSupport(domainId);
}

const SHARED_MANAGER_SKILL_CATALOG: BuiltinSkillEntry[] = [
  {
    id: managerQueryLocalMatchesDeclaration.name,
    declaration: managerQueryLocalMatchesDeclaration,
    execute: (args) =>
      executeManagerQueryLocalMatches({
        ...args,
        support: buildRuntimeSupport(args?.domainId),
        resolveSupport: resolveRuntimeSupport,
      }),
    version: '1.0.0',
  },
  {
    id: managerDescribeCapabilityDeclaration.name,
    declaration: managerDescribeCapabilityDeclaration,
    execute: (args) =>
      executeManagerDescribeCapability({
        ...args,
        support: buildRuntimeSupport(args?.domainId),
        resolveSupport: resolveRuntimeSupport,
      }),
    version: '1.0.0',
  },
  {
    id: managerPrepareTaskIntakeDeclaration.name,
    declaration: managerPrepareTaskIntakeDeclaration,
    execute: (args) =>
      executeManagerPrepareTaskIntake({
        ...args,
        support: buildRuntimeSupport(args?.defaultDomainId),
        resolveSupport: resolveRuntimeSupport,
      }),
    version: '1.0.0',
  },
  {
    id: managerContinueTaskIntakeDeclaration.name,
    declaration: managerContinueTaskIntakeDeclaration,
    execute: (args) =>
      executeManagerContinueTaskIntake({
        ...args,
        support: buildRuntimeSupport(
          args?.intakeWorkflow?.domainId || args?.pendingTask?.drafts?.[0]?.domainId || args?.domainId,
        ),
        resolveSupport: resolveRuntimeSupport,
      }),
    version: '1.0.0',
  },
  {
    id: managerHelpDeclaration.name,
    declaration: managerHelpDeclaration,
    execute: (args) =>
      executeManagerHelp({
        ...args,
        support: buildRuntimeSupport(args?.domainId),
        resolveSupport: resolveRuntimeSupport,
      }),
    version: '1.0.0',
  },
];

function resolveDomainManagerSkillIds(domainId?: string | null): string[] {
  const runtimePack =
    getRuntimeDomainPackById(domainId) ||
    (domainId ? null : getDefaultRuntimeDomainPack());
  return Array.isArray(runtimePack?.manager?.skillIds) ? runtimePack.manager.skillIds : [];
}

function collectEnabledSkillIds(): Set<string> {
  const enabled = new Set<string>();
  listRuntimeDomainPacks().forEach((runtimePack) => {
    const skillIds = runtimePack.manager?.skillIds;
    if (!Array.isArray(skillIds)) {
      return;
    }

    skillIds.forEach((skillId) => {
      if (typeof skillId === 'string' && skillId.trim().length > 0) {
        enabled.add(skillId.trim());
      }
    });
  });
  return enabled;
}

export function listRuntimeManagerBuiltinSkillEntries(): BuiltinSkillEntry[] {
  const enabledSkillIds = collectEnabledSkillIds();
  return SHARED_MANAGER_SKILL_CATALOG.filter((entry) => enabledSkillIds.has(entry.id));
}

export function listRuntimeManagerToolIds(): string[] {
  return listRuntimeManagerBuiltinSkillEntries().map((entry) => entry.id);
}

export function listRuntimeManagerToolIdsForDomain(domainId?: string | null): string[] {
  const supportedIds = new Set(resolveDomainManagerSkillIds(domainId));
  return SHARED_MANAGER_SKILL_CATALOG.filter((entry) => supportedIds.has(entry.id)).map(
    (entry) => entry.id,
  );
}

export function supportsRuntimeManagerTool(
  domainId: string | null | undefined,
  toolId: string,
): boolean {
  return resolveDomainManagerSkillIds(domainId).includes(toolId);
}
