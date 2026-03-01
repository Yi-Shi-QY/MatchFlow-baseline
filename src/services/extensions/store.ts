import {
  AgentExtensionManifest,
  ExtensionKind,
  ExtensionStore,
  InstalledExtensionRecord,
  SkillExtensionManifest,
  TemplateExtensionManifest,
} from "./types";
import {
  compareSemver,
  sanitizeAgentManifest,
  sanitizeSkillManifest,
  sanitizeTemplateManifest,
  validateAgentManifest,
  validateSkillManifest,
  validateTemplateManifest,
} from "./validation";

const EXTENSION_STORE_KEY = "matchflow_extension_store_v1";

function cloneEmptyStore(): ExtensionStore {
  return {
    schemaVersion: 1,
    agents: {},
    skills: {},
    templates: {},
  };
}

function safeParseStore(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeRecord<
  T extends AgentExtensionManifest | SkillExtensionManifest | TemplateExtensionManifest,
>(
  rawRecord: any,
  validator: (input: any) => { ok: boolean; errors: string[] },
  sanitizer: (input: any) => T,
): InstalledExtensionRecord<T> | null {
  if (!rawRecord || typeof rawRecord !== "object" || !rawRecord.manifest) {
    return null;
  }
  const validation = validator(rawRecord.manifest);
  if (!validation.ok) {
    return null;
  }
  return {
    manifest: sanitizer(rawRecord.manifest),
    installedAt:
      typeof rawRecord.installedAt === "number" ? rawRecord.installedAt : Date.now(),
    source: "hub",
    sourceUrl:
      typeof rawRecord.sourceUrl === "string" ? rawRecord.sourceUrl : undefined,
  };
}

function normalizeStore(input: any): ExtensionStore {
  if (!input || typeof input !== "object") {
    return cloneEmptyStore();
  }

  const normalized: ExtensionStore = cloneEmptyStore();

  if (input.agents && typeof input.agents === "object") {
    Object.entries(input.agents).forEach(([id, record]) => {
      const normalizedRecord = normalizeRecord(
        record,
        validateAgentManifest,
        sanitizeAgentManifest,
      );
      if (normalizedRecord && normalizedRecord.manifest.id === id) {
        normalized.agents[id] = normalizedRecord;
      }
    });
  }

  if (input.skills && typeof input.skills === "object") {
    Object.entries(input.skills).forEach(([id, record]) => {
      const normalizedRecord = normalizeRecord(
        record,
        validateSkillManifest,
        sanitizeSkillManifest,
      );
      if (normalizedRecord && normalizedRecord.manifest.id === id) {
        normalized.skills[id] = normalizedRecord;
      }
    });
  }

  if (input.templates && typeof input.templates === "object") {
    Object.entries(input.templates).forEach(([id, record]) => {
      const normalizedRecord = normalizeRecord(
        record,
        validateTemplateManifest,
        sanitizeTemplateManifest,
      );
      if (normalizedRecord && normalizedRecord.manifest.id === id) {
        normalized.templates[id] = normalizedRecord;
      }
    });
  }

  return normalized;
}

function readStore(): ExtensionStore {
  if (typeof localStorage === "undefined") {
    return cloneEmptyStore();
  }
  const parsed = safeParseStore(localStorage.getItem(EXTENSION_STORE_KEY));
  return normalizeStore(parsed);
}

function writeStore(store: ExtensionStore) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(EXTENSION_STORE_KEY, JSON.stringify(store));
}

function shouldReplaceVersion(existingVersion: string, incomingVersion: string): boolean {
  return compareSemver(incomingVersion, existingVersion) > 0;
}

export function getExtensionStore(): ExtensionStore {
  return readStore();
}

export function clearExtensionStore() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(EXTENSION_STORE_KEY);
}

export function getInstalledAgentManifest(id: string): AgentExtensionManifest | null {
  const store = readStore();
  return store.agents[id]?.manifest || null;
}

export function getInstalledSkillManifest(id: string): SkillExtensionManifest | null {
  const store = readStore();
  return store.skills[id]?.manifest || null;
}

export function getInstalledTemplateManifest(id: string): TemplateExtensionManifest | null {
  const store = readStore();
  return store.templates[id]?.manifest || null;
}

export function listInstalledAgentManifests(): AgentExtensionManifest[] {
  const store = readStore();
  return Object.values(store.agents).map((entry) => entry.manifest);
}

export function listInstalledSkillManifests(): SkillExtensionManifest[] {
  const store = readStore();
  return Object.values(store.skills).map((entry) => entry.manifest);
}

export function listInstalledTemplateManifests(): TemplateExtensionManifest[] {
  const store = readStore();
  return Object.values(store.templates).map((entry) => entry.manifest);
}

export function saveInstalledAgentManifest(
  manifest: AgentExtensionManifest,
  sourceUrl?: string,
) {
  const store = readStore();
  const existing = store.agents[manifest.id];
  if (existing && !shouldReplaceVersion(existing.manifest.version, manifest.version)) {
    return false;
  }
  store.agents[manifest.id] = {
    manifest,
    installedAt: Date.now(),
    source: "hub",
    sourceUrl,
  };
  writeStore(store);
  return true;
}

export function saveInstalledSkillManifest(
  manifest: SkillExtensionManifest,
  sourceUrl?: string,
) {
  const store = readStore();
  const existing = store.skills[manifest.id];
  if (existing && !shouldReplaceVersion(existing.manifest.version, manifest.version)) {
    return false;
  }
  store.skills[manifest.id] = {
    manifest,
    installedAt: Date.now(),
    source: "hub",
    sourceUrl,
  };
  writeStore(store);
  return true;
}

export function saveInstalledTemplateManifest(
  manifest: TemplateExtensionManifest,
  sourceUrl?: string,
) {
  const store = readStore();
  const existing = store.templates[manifest.id];
  if (existing && !shouldReplaceVersion(existing.manifest.version, manifest.version)) {
    return false;
  }
  store.templates[manifest.id] = {
    manifest,
    installedAt: Date.now(),
    source: "hub",
    sourceUrl,
  };
  writeStore(store);
  return true;
}

export function removeInstalledAgentManifest(id: string): boolean {
  const store = readStore();
  if (!store.agents[id]) return false;
  delete store.agents[id];
  writeStore(store);
  return true;
}

export function removeInstalledSkillManifest(id: string): boolean {
  const store = readStore();
  if (!store.skills[id]) return false;
  delete store.skills[id];
  writeStore(store);
  return true;
}

export function removeInstalledTemplateManifest(id: string): boolean {
  const store = readStore();
  if (!store.templates[id]) return false;
  delete store.templates[id];
  writeStore(store);
  return true;
}

export function removeInstalledExtension(kind: ExtensionKind, id: string): boolean {
  if (kind === "agent") return removeInstalledAgentManifest(id);
  if (kind === "skill") return removeInstalledSkillManifest(id);
  return removeInstalledTemplateManifest(id);
}

export function listInstalledExtensionRecords(): Array<{
  kind: ExtensionKind;
  id: string;
  version: string;
  name: string;
  description: string;
  installedAt: number;
  source: "hub";
  sourceUrl?: string;
  manifest: AgentExtensionManifest | SkillExtensionManifest | TemplateExtensionManifest;
}> {
  const store = readStore();
  const agentRecords = Object.values(store.agents).map((entry) => ({
    kind: "agent" as const,
    id: entry.manifest.id,
    version: entry.manifest.version,
    name: entry.manifest.name,
    description: entry.manifest.description,
    installedAt: entry.installedAt,
    source: entry.source,
    sourceUrl: entry.sourceUrl,
    manifest: entry.manifest,
  }));
  const skillRecords = Object.values(store.skills).map((entry) => ({
    kind: "skill" as const,
    id: entry.manifest.id,
    version: entry.manifest.version,
    name: entry.manifest.name,
    description: entry.manifest.description,
    installedAt: entry.installedAt,
    source: entry.source,
    sourceUrl: entry.sourceUrl,
    manifest: entry.manifest,
  }));
  const templateRecords = Object.values(store.templates).map((entry) => ({
    kind: "template" as const,
    id: entry.manifest.id,
    version: entry.manifest.version,
    name: entry.manifest.name,
    description: entry.manifest.description,
    installedAt: entry.installedAt,
    source: entry.source,
    sourceUrl: entry.sourceUrl,
    manifest: entry.manifest,
  }));

  return [...agentRecords, ...skillRecords, ...templateRecords].sort(
    (a, b) => b.installedAt - a.installedAt,
  );
}
