import type { HubEndpointHint } from "@/src/services/extensions/types";

export interface DomainPackManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  baseDomainId?: string;
  minAppVersion?: string;
  updatedAt?: string;
  recommendedAgents?: string[];
  recommendedSkills?: string[];
  recommendedTemplates?: string[];
  skillHttpAllowedHosts?: string[];
  hub?: HubEndpointHint;
}

export interface InstalledDomainPackRecord {
  manifest: DomainPackManifest;
  installedAt: number;
  source: "hub";
  sourceUrl?: string;
}
