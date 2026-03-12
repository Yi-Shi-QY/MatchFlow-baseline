import { DEFAULT_DOMAIN_ID } from '@/src/services/domains/builtinModules';
import { getInstalledDomainPackManifest } from '@/src/services/domains/packStore';
import type { DomainRuntimePack } from './types';
import { footballRuntimePack } from './football';

const BUILTIN_RUNTIME_PACKS: Record<string, DomainRuntimePack> = {
  [footballRuntimePack.manifest.domainId]: footballRuntimePack,
};

function listBuiltinRuntimePacksInternal(): DomainRuntimePack[] {
  return Object.values(BUILTIN_RUNTIME_PACKS).sort((left, right) =>
    left.manifest.domainId.localeCompare(right.manifest.domainId),
  );
}

export function listRuntimeDomainPacks(): DomainRuntimePack[] {
  return listBuiltinRuntimePacksInternal();
}

export function getRuntimeDomainPackById(
  domainId: string | null | undefined,
): DomainRuntimePack | null {
  if (!domainId) {
    return null;
  }

  const direct = BUILTIN_RUNTIME_PACKS[domainId];
  if (direct) {
    return direct;
  }

  const aliasManifest = getInstalledDomainPackManifest(domainId);
  const baseDomainId = aliasManifest?.baseDomainId;
  if (baseDomainId && BUILTIN_RUNTIME_PACKS[baseDomainId]) {
    return BUILTIN_RUNTIME_PACKS[baseDomainId];
  }

  return null;
}

export function getDefaultRuntimeDomainPack(): DomainRuntimePack {
  return (
    getRuntimeDomainPackById(DEFAULT_DOMAIN_ID) ||
    listBuiltinRuntimePacksInternal()[0] ||
    footballRuntimePack
  );
}

export function resolveRuntimeDomainPack(
  domainId: string | null | undefined,
): DomainRuntimePack {
  return getRuntimeDomainPackById(domainId) || getDefaultRuntimeDomainPack();
}
