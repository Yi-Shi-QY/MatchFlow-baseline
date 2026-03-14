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
} from './toolRegistry';

const SHARED_MANAGER_SKILL_CATALOG: BuiltinSkillEntry[] = [
  {
    id: managerQueryLocalMatchesDeclaration.name,
    declaration: managerQueryLocalMatchesDeclaration,
    execute: executeManagerQueryLocalMatches,
    version: '1.0.0',
  },
  {
    id: managerDescribeCapabilityDeclaration.name,
    declaration: managerDescribeCapabilityDeclaration,
    execute: executeManagerDescribeCapability,
    version: '1.0.0',
  },
  {
    id: managerPrepareTaskIntakeDeclaration.name,
    declaration: managerPrepareTaskIntakeDeclaration,
    execute: executeManagerPrepareTaskIntake,
    version: '1.0.0',
  },
  {
    id: managerContinueTaskIntakeDeclaration.name,
    declaration: managerContinueTaskIntakeDeclaration,
    execute: executeManagerContinueTaskIntake,
    version: '1.0.0',
  },
  {
    id: managerHelpDeclaration.name,
    declaration: managerHelpDeclaration,
    execute: executeManagerHelp,
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
