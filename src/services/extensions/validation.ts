import {
  AgentExtensionManifest,
  ExtensionValidationResult,
  SkillRuntime,
  SkillExtensionManifest,
  TemplateExtensionManifest,
} from "./types";

const ID_PATTERN = /^[a-z0-9_][a-z0-9_-]{1,63}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function normalizeStringArray(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v) => typeof v === "string" && v.trim().length > 0);
}

function isPlainObject(input: any): input is Record<string, any> {
  return !!input && typeof input === "object" && !Array.isArray(input);
}

function normalizeStringRecord(input: any): Record<string, string> {
  if (!isPlainObject(input)) return {};
  const output: Record<string, string> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (typeof value === "string" && key.trim().length > 0) {
      output[key] = value;
    }
  });
  return output;
}

function normalizePrimitiveRecord(
  input: any,
): Record<string, string | number | boolean> {
  if (!isPlainObject(input)) return {};
  const output: Record<string, string | number | boolean> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (key.trim().length === 0) return;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      output[key] = value;
    }
  });
  return output;
}

function validateBaseCommon(input: any, expectedKind: string, errors: string[]) {
  if (!input || typeof input !== "object") {
    errors.push("manifest must be an object");
    return;
  }

  if (input.kind !== expectedKind) {
    errors.push(`manifest.kind must be "${expectedKind}"`);
  }

  if (typeof input.id !== "string" || !ID_PATTERN.test(input.id)) {
    errors.push("manifest.id is invalid");
  }

  if (typeof input.version !== "string" || !SEMVER_PATTERN.test(input.version)) {
    errors.push("manifest.version must follow semver format (x.y.z)");
  }

  if (typeof input.name !== "string" || input.name.trim().length === 0) {
    errors.push("manifest.name is required");
  }

  if (
    typeof input.description !== "string" ||
    input.description.trim().length === 0
  ) {
    errors.push("manifest.description is required");
  }
}

export function compareSemver(a: string, b: string): number {
  const normalize = (value: string) => {
    const [core] = value.split("-");
    const [maj, min, patch] = core.split(".").map((n) => Number(n) || 0);
    return { maj, min, patch };
  };
  const av = normalize(a);
  const bv = normalize(b);
  if (av.maj !== bv.maj) return av.maj > bv.maj ? 1 : -1;
  if (av.min !== bv.min) return av.min > bv.min ? 1 : -1;
  if (av.patch !== bv.patch) return av.patch > bv.patch ? 1 : -1;
  return 0;
}

export function validateAgentManifest(input: any): ExtensionValidationResult {
  const errors: string[] = [];
  validateBaseCommon(input, "agent", errors);

  if (
    !input?.rolePrompt ||
    typeof input.rolePrompt !== "object" ||
    typeof input.rolePrompt.en !== "string" ||
    input.rolePrompt.en.trim().length === 0 ||
    typeof input.rolePrompt.zh !== "string" ||
    input.rolePrompt.zh.trim().length === 0
  ) {
    errors.push("agent.rolePrompt.en and agent.rolePrompt.zh are required");
  }

  const deps = input?.contextDependencies;
  const depsValid =
    deps === undefined ||
    deps === "all" ||
    deps === "none" ||
    Array.isArray(deps);
  if (!depsValid) {
    errors.push("agent.contextDependencies must be 'all' | 'none' | string[]");
  }
  if (Array.isArray(deps)) {
    const badDep = deps.some((item) => typeof item !== "string" || item.trim().length === 0);
    if (badDep) {
      errors.push("agent.contextDependencies array must contain non-empty strings");
    }
  }

  if (input?.skills !== undefined && !Array.isArray(input.skills)) {
    errors.push("agent.skills must be string[] when provided");
  }

  return { ok: errors.length === 0, errors };
}

export function sanitizeAgentManifest(input: any): AgentExtensionManifest {
  return {
    kind: "agent",
    id: String(input.id).trim(),
    version: String(input.version).trim(),
    name: String(input.name).trim(),
    description: String(input.description).trim(),
    minAppVersion:
      typeof input.minAppVersion === "string" ? input.minAppVersion.trim() : undefined,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined,
    rolePrompt: {
      en: String(input.rolePrompt?.en || "").trim(),
      zh: String(input.rolePrompt?.zh || "").trim(),
    },
    skills: normalizeStringArray(input.skills),
    contextDependencies:
      input.contextDependencies === "all" || input.contextDependencies === "none"
        ? input.contextDependencies
        : normalizeStringArray(input.contextDependencies),
  };
}

export function validateSkillManifest(input: any): ExtensionValidationResult {
  const errors: string[] = [];
  validateBaseCommon(input, "skill", errors);

  if (!input?.declaration || typeof input.declaration !== "object") {
    errors.push("skill.declaration is required");
  } else {
    if (typeof input.declaration.name !== "string" || input.declaration.name.trim().length === 0) {
      errors.push("skill.declaration.name is required");
    }
    if (
      typeof input.id === "string" &&
      typeof input.declaration.name === "string" &&
      input.declaration.name.trim() !== input.id.trim()
    ) {
      errors.push("skill.declaration.name must match manifest.id");
    }
  }

  if (!input?.runtime || typeof input.runtime !== "object") {
    errors.push("skill.runtime is required");
  } else {
    const mode = input.runtime.mode;
    if (mode === "builtin_alias") {
      if (
        typeof input.runtime.targetSkill !== "string" ||
        input.runtime.targetSkill.trim().length === 0
      ) {
        errors.push("skill.runtime.targetSkill is required");
      }
    } else if (mode === "http_json") {
      const request = input.runtime.request;
      if (!request || typeof request !== "object") {
        errors.push("skill.runtime.request is required for mode=http_json");
      } else {
        if (typeof request.url !== "string" || request.url.trim().length === 0) {
          errors.push("skill.runtime.request.url is required");
        }
        if (request.method !== undefined) {
          const method = String(request.method).toUpperCase();
          const validMethod =
            method === "GET" ||
            method === "POST" ||
            method === "PUT" ||
            method === "PATCH" ||
            method === "DELETE";
          if (!validMethod) {
            errors.push(
              "skill.runtime.request.method must be GET|POST|PUT|PATCH|DELETE",
            );
          }
        }
        if (request.headers !== undefined) {
          if (!isPlainObject(request.headers)) {
            errors.push("skill.runtime.request.headers must be an object");
          } else {
            const hasInvalidHeaderValue = Object.values(request.headers).some(
              (value) => typeof value !== "string",
            );
            if (hasInvalidHeaderValue) {
              errors.push("skill.runtime.request.headers values must be strings");
            }
          }
        }
        if (request.query !== undefined) {
          if (!isPlainObject(request.query)) {
            errors.push("skill.runtime.request.query must be an object");
          } else {
            const hasInvalidQueryValue = Object.values(request.query).some(
              (value) =>
                !(
                  typeof value === "string" ||
                  typeof value === "number" ||
                  typeof value === "boolean"
                ),
            );
            if (hasInvalidQueryValue) {
              errors.push(
                "skill.runtime.request.query values must be string|number|boolean",
              );
            }
          }
        }
        if (request.timeoutMs !== undefined) {
          if (
            typeof request.timeoutMs !== "number" ||
            !Number.isFinite(request.timeoutMs) ||
            request.timeoutMs <= 0
          ) {
            errors.push("skill.runtime.request.timeoutMs must be a positive number");
          }
        }
        if (request.auth !== undefined) {
          if (
            request.auth !== "none" &&
            request.auth !== "match_data_api_key"
          ) {
            errors.push(
              "skill.runtime.request.auth must be 'none' | 'match_data_api_key'",
            );
          }
        }
      }

      const response = input.runtime.response;
      if (response !== undefined && !isPlainObject(response)) {
        errors.push("skill.runtime.response must be an object when provided");
      } else if (
        response &&
        response.pickPath !== undefined &&
        (typeof response.pickPath !== "string" || response.pickPath.trim().length === 0)
      ) {
        errors.push("skill.runtime.response.pickPath must be a non-empty string");
      }
    } else if (mode === "static_result") {
      // No extra validation for static_result payload.
    } else {
      errors.push(
        "skill.runtime.mode must be 'builtin_alias' | 'http_json' | 'static_result'",
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

function sanitizeSkillRuntime(input: any): SkillRuntime {
  if (input?.mode === "builtin_alias") {
    return {
      mode: "builtin_alias",
      targetSkill: String(input.targetSkill || "").trim(),
    };
  }

  if (input?.mode === "http_json") {
    const requestInput = isPlainObject(input.request) ? input.request : {};
    const methodRaw =
      typeof requestInput.method === "string"
        ? requestInput.method.toUpperCase()
        : undefined;
    const method =
      methodRaw === "GET" ||
      methodRaw === "POST" ||
      methodRaw === "PUT" ||
      methodRaw === "PATCH" ||
      methodRaw === "DELETE"
        ? (methodRaw as "GET" | "POST" | "PUT" | "PATCH" | "DELETE")
        : undefined;
    const timeout =
      typeof requestInput.timeoutMs === "number" &&
      Number.isFinite(requestInput.timeoutMs) &&
      requestInput.timeoutMs > 0
        ? requestInput.timeoutMs
        : undefined;
    const auth =
      requestInput.auth === "match_data_api_key" ||
      requestInput.auth === "none"
        ? requestInput.auth
        : undefined;
    const responseInput = isPlainObject(input.response) ? input.response : undefined;
    const pickPath =
      typeof responseInput?.pickPath === "string" && responseInput.pickPath.trim().length > 0
        ? responseInput.pickPath.trim()
        : undefined;

    return {
      mode: "http_json",
      request: {
        method,
        url: String(requestInput.url || "").trim(),
        headers: normalizeStringRecord(requestInput.headers),
        query: normalizePrimitiveRecord(requestInput.query),
        body: requestInput.body,
        auth,
        timeoutMs: timeout,
      },
      ...((pickPath || responseInput?.defaultValue !== undefined) && {
        response: {
          ...(pickPath ? { pickPath } : {}),
          ...(responseInput?.defaultValue !== undefined
            ? { defaultValue: responseInput.defaultValue }
            : {}),
        },
      }),
    } as SkillRuntime;
  }

  if (input?.mode === "static_result") {
    return {
      mode: "static_result",
      value: input.value,
    };
  }

  return {
    mode: "builtin_alias",
    targetSkill: "",
  };
}

export function sanitizeSkillManifest(input: any): SkillExtensionManifest {
  return {
    kind: "skill",
    id: String(input.id).trim(),
    version: String(input.version).trim(),
    name: String(input.name).trim(),
    description: String(input.description).trim(),
    minAppVersion:
      typeof input.minAppVersion === "string" ? input.minAppVersion.trim() : undefined,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined,
    declaration: input.declaration,
    runtime: sanitizeSkillRuntime(input.runtime),
  };
}

export function validateTemplateManifest(input: any): ExtensionValidationResult {
  const errors: string[] = [];
  validateBaseCommon(input, "template", errors);

  if (typeof input?.rule !== "string" || input.rule.trim().length === 0) {
    errors.push("template.rule is required");
  }

  if (!Array.isArray(input?.segments) || input.segments.length === 0) {
    errors.push("template.segments must be a non-empty array");
  } else {
    input.segments.forEach((segment: any, index: number) => {
      if (!segment || typeof segment !== "object") {
        errors.push(`template.segments[${index}] must be an object`);
        return;
      }
      const titleEn = segment?.title?.en;
      const titleZh = segment?.title?.zh;
      if (typeof titleEn !== "string" || titleEn.trim().length === 0) {
        errors.push(`template.segments[${index}].title.en is required`);
      }
      if (typeof titleZh !== "string" || titleZh.trim().length === 0) {
        errors.push(`template.segments[${index}].title.zh is required`);
      }
      const focusEn = segment?.focus?.en;
      const focusZh = segment?.focus?.zh;
      if (typeof focusEn !== "string" || focusEn.trim().length === 0) {
        errors.push(`template.segments[${index}].focus.en is required`);
      }
      if (typeof focusZh !== "string" || focusZh.trim().length === 0) {
        errors.push(`template.segments[${index}].focus.zh is required`);
      }
      if (
        typeof segment?.agentType !== "string" ||
        segment.agentType.trim().length === 0
      ) {
        errors.push(`template.segments[${index}].agentType is required`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

export function sanitizeTemplateManifest(input: any): TemplateExtensionManifest {
  const normalizeSegments = Array.isArray(input?.segments)
    ? input.segments.map((segment: any) => ({
        title: {
          en: String(segment?.title?.en || "").trim(),
          zh: String(segment?.title?.zh || "").trim(),
        },
        focus: {
          en: String(segment?.focus?.en || "").trim(),
          zh: String(segment?.focus?.zh || "").trim(),
        },
        animationType:
          typeof segment?.animationType === "string" ? segment.animationType : "none",
        agentType: String(segment?.agentType || "general").trim(),
        contextMode:
          typeof segment?.contextMode === "string" ? segment.contextMode : "build_upon",
      }))
    : [];

  return {
    kind: "template",
    id: String(input.id).trim(),
    version: String(input.version).trim(),
    name: String(input.name).trim(),
    description: String(input.description).trim(),
    rule: String(input.rule).trim(),
    minAppVersion:
      typeof input.minAppVersion === "string" ? input.minAppVersion.trim() : undefined,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined,
    requiredAgents: normalizeStringArray(input.requiredAgents),
    requiredSkills: normalizeStringArray(input.requiredSkills),
    segments: normalizeSegments,
  };
}

