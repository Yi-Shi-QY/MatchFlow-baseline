import { compareSemverValues, isValidSemver } from "@/src/services/appMeta";
import type { DomainPackManifest } from "./packTypes";

const ID_PATTERN = /^[a-z0-9_][a-z0-9_-]{1,63}$/;

function normalizeStringArray(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function compareDomainPackSemver(a: string, b: string): number {
  return compareSemverValues(a, b);
}

export function validateDomainPackManifest(input: any): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    errors.push("domain pack manifest must be an object");
    return { ok: false, errors };
  }

  if (typeof input.id !== "string" || !ID_PATTERN.test(input.id)) {
    errors.push("domain pack manifest.id is invalid");
  }
  if (typeof input.version !== "string" || !isValidSemver(input.version)) {
    errors.push("domain pack manifest.version must follow semver format");
  }
  if (typeof input.name !== "string" || input.name.trim().length === 0) {
    errors.push("domain pack manifest.name is required");
  }
  if (typeof input.description !== "string" || input.description.trim().length === 0) {
    errors.push("domain pack manifest.description is required");
  }
  if (
    input.baseDomainId !== undefined &&
    (typeof input.baseDomainId !== "string" || input.baseDomainId.trim().length === 0)
  ) {
    errors.push("domain pack manifest.baseDomainId must be a non-empty string");
  }
  if (input.minAppVersion !== undefined && !isValidSemver(input.minAppVersion)) {
    errors.push("domain pack manifest.minAppVersion must follow semver format");
  }
  if (input.updatedAt !== undefined && typeof input.updatedAt !== "string") {
    errors.push("domain pack manifest.updatedAt must be a string");
  }

  const listFields = [
    "recommendedAgents",
    "recommendedSkills",
    "recommendedTemplates",
    "skillHttpAllowedHosts",
  ];
  listFields.forEach((field) => {
    if (input[field] !== undefined && !Array.isArray(input[field])) {
      errors.push(`domain pack manifest.${field} must be an array when provided`);
    }
  });

  return { ok: errors.length === 0, errors };
}

export function sanitizeDomainPackManifest(input: any): DomainPackManifest {
  return {
    id: String(input.id || "").trim(),
    version: String(input.version || "").trim(),
    name: String(input.name || "").trim(),
    description: String(input.description || "").trim(),
    baseDomainId:
      typeof input.baseDomainId === "string" && input.baseDomainId.trim().length > 0
        ? input.baseDomainId.trim()
        : undefined,
    minAppVersion:
      typeof input.minAppVersion === "string" && input.minAppVersion.trim().length > 0
        ? input.minAppVersion.trim()
        : undefined,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined,
    recommendedAgents: normalizeStringArray(input.recommendedAgents),
    recommendedSkills: normalizeStringArray(input.recommendedSkills),
    recommendedTemplates: normalizeStringArray(input.recommendedTemplates),
    skillHttpAllowedHosts: normalizeStringArray(input.skillHttpAllowedHosts),
    hub:
      input.hub && typeof input.hub === "object"
        ? {
            baseUrl:
              typeof input.hub.baseUrl === "string" ? input.hub.baseUrl.trim() : undefined,
            apiKey: typeof input.hub.apiKey === "string" ? input.hub.apiKey.trim() : undefined,
            autoInstall:
              typeof input.hub.autoInstall === "boolean" ? input.hub.autoInstall : undefined,
          }
        : undefined,
  };
}
