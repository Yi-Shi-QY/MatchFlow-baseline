import { getSettings } from "@/src/services/settings";
import { footballDomain } from "./football";
import { listInstalledDomainPackManifests } from "./packStore";
import type { DomainPackManifest } from "./packTypes";
import type { AnalysisDomain } from "./types";

const BUILTIN_DOMAINS: Record<string, AnalysisDomain> = {
  [footballDomain.id]: footballDomain,
};

function getBuiltinDomainById(id: string): AnalysisDomain | null {
  return BUILTIN_DOMAINS[id] || null;
}

function mergeDomainResources(
  base: AnalysisDomain["resources"],
  pack: DomainPackManifest,
): AnalysisDomain["resources"] {
  const merged = {
    templates: [...(base?.templates || []), ...(pack.recommendedTemplates || [])],
    animations: [...(base?.animations || [])],
    agents: [...(base?.agents || []), ...(pack.recommendedAgents || [])],
    skills: [...(base?.skills || []), ...(pack.recommendedSkills || [])],
  };

  return {
    templates: Array.from(new Set(merged.templates)),
    animations: Array.from(new Set(merged.animations)),
    agents: Array.from(new Set(merged.agents)),
    skills: Array.from(new Set(merged.skills)),
  };
}

function buildPackDomainAlias(pack: DomainPackManifest): AnalysisDomain | null {
  const baseId = pack.baseDomainId || "football";
  const base = getBuiltinDomainById(baseId);
  if (!base) return null;

  return {
    ...base,
    id: pack.id,
    name: pack.name,
    description: pack.description,
    resources: mergeDomainResources(base.resources, pack),
  };
}

function buildRuntimeDomains(): Record<string, AnalysisDomain> {
  const runtime: Record<string, AnalysisDomain> = {
    ...BUILTIN_DOMAINS,
  };

  const installedPacks = listInstalledDomainPackManifests();
  installedPacks.forEach((pack) => {
    const alias = buildPackDomainAlias(pack);
    if (!alias) return;
    runtime[alias.id] = alias;
  });

  return runtime;
}

export function listAnalysisDomains(): AnalysisDomain[] {
  return Object.values(buildRuntimeDomains());
}

export function getAnalysisDomainById(
  domainId: string | null | undefined,
): AnalysisDomain | null {
  if (!domainId) return null;
  return buildRuntimeDomains()[domainId] || null;
}

export function getActiveAnalysisDomain(): AnalysisDomain {
  const configuredDomainId = getSettings().activeDomainId;
  return getAnalysisDomainById(configuredDomainId) || footballDomain;
}
