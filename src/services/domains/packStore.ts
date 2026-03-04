import type { DomainPackManifest, InstalledDomainPackRecord } from "./packTypes";
import {
  compareDomainPackSemver,
  sanitizeDomainPackManifest,
  validateDomainPackManifest,
} from "./packValidation";

const DOMAIN_PACK_STORE_KEY = "matchflow_domain_pack_store_v2";
let domainPackStoreCache: DomainPackStore | null = null;

interface DomainPackStore {
  schemaVersion: 1;
  packs: Record<string, InstalledDomainPackRecord>;
}

function cloneEmptyStore(): DomainPackStore {
  return {
    schemaVersion: 1,
    packs: {},
  };
}

function safeParse(input: string | null): any {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function normalizeRecord(input: any): InstalledDomainPackRecord | null {
  if (!input || typeof input !== "object" || !input.manifest) return null;
  const validation = validateDomainPackManifest(input.manifest);
  if (!validation.ok) return null;
  return {
    manifest: sanitizeDomainPackManifest(input.manifest),
    installedAt: typeof input.installedAt === "number" ? input.installedAt : Date.now(),
    source: "hub",
    sourceUrl: typeof input.sourceUrl === "string" ? input.sourceUrl : undefined,
  };
}

function normalizeStore(input: any): DomainPackStore {
  if (!input || typeof input !== "object") return cloneEmptyStore();
  const store = cloneEmptyStore();
  if (input.packs && typeof input.packs === "object") {
    Object.entries(input.packs).forEach(([id, rawRecord]) => {
      const record = normalizeRecord(rawRecord);
      if (record && record.manifest.id === id) {
        store.packs[id] = record;
      }
    });
  }
  return store;
}

function readStore(): DomainPackStore {
  if (domainPackStoreCache) {
    return domainPackStoreCache;
  }
  if (typeof localStorage === "undefined") {
    domainPackStoreCache = cloneEmptyStore();
    return domainPackStoreCache;
  }
  const parsed = safeParse(localStorage.getItem(DOMAIN_PACK_STORE_KEY));
  domainPackStoreCache = normalizeStore(parsed);
  return domainPackStoreCache;
}

function writeStore(store: DomainPackStore) {
  domainPackStoreCache = store;
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DOMAIN_PACK_STORE_KEY, JSON.stringify(store));
}

function shouldReplaceVersion(existingVersion: string, incomingVersion: string): boolean {
  return compareDomainPackSemver(incomingVersion, existingVersion) > 0;
}

export function getInstalledDomainPackManifest(id: string): DomainPackManifest | null {
  const store = readStore();
  return store.packs[id]?.manifest || null;
}

export function listInstalledDomainPackManifests(): DomainPackManifest[] {
  const store = readStore();
  return Object.values(store.packs).map((entry) => entry.manifest);
}

export function listInstalledDomainPackRecords(): InstalledDomainPackRecord[] {
  const store = readStore();
  return Object.values(store.packs).sort((a, b) => b.installedAt - a.installedAt);
}

export function saveInstalledDomainPackManifest(
  manifest: DomainPackManifest,
  sourceUrl?: string,
): boolean {
  const store = readStore();
  const existing = store.packs[manifest.id];
  if (existing && !shouldReplaceVersion(existing.manifest.version, manifest.version)) {
    return false;
  }

  store.packs[manifest.id] = {
    manifest,
    installedAt: Date.now(),
    source: "hub",
    sourceUrl,
  };
  writeStore(store);
  return true;
}

export function removeInstalledDomainPackManifest(id: string): boolean {
  const store = readStore();
  if (!store.packs[id]) return false;
  delete store.packs[id];
  writeStore(store);
  return true;
}

export function clearInstalledDomainPacks() {
  domainPackStoreCache = cloneEmptyStore();
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(DOMAIN_PACK_STORE_KEY);
}
