import { FunctionDeclaration } from "@google/genai";
import { calculatorDeclaration, executeCalculator } from "./calculator";
import {
  getInstalledSkillManifest,
  listInstalledSkillManifests,
} from "@/src/services/extensions/store";
import {
  SkillRuntimeHttpJson,
  SkillRuntimeStaticResult,
} from "@/src/services/extensions/types";
import { executeSelectPlanTemplate, selectPlanTemplateDeclaration } from "./planner";
import { getInstalledDomainPackManifest } from "@/src/services/domains/packStore";
import { getSettings } from "@/src/services/settings";

type BuiltinSkillExecutor = (args: any) => Promise<any>;

const BUILTIN_SKILL_DECLARATIONS: Record<string, FunctionDeclaration> = {
  calculator: calculatorDeclaration,
  select_plan_template: selectPlanTemplateDeclaration,
};

const BUILTIN_SKILL_EXECUTORS: Record<string, BuiltinSkillExecutor> = {
  calculator: executeCalculator,
  select_plan_template: executeSelectPlanTemplate,
};

export const BUILTIN_SKILL_VERSIONS: Record<string, string> = {
  calculator: "1.0.0",
  select_plan_template: "1.0.0",
};

function isPlainObject(input: any): input is Record<string, any> {
  return !!input && typeof input === "object" && !Array.isArray(input);
}

function isLocalhost(hostname: string): boolean {
  const normalized = String(hostname || "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function normalizeHostPattern(input: any): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.includes("://")) {
    try {
      const parsed = new URL(trimmed);
      return parsed.host || parsed.hostname || null;
    } catch {
      return null;
    }
  }

  return trimmed.replace(/^\/+/, "");
}

function getConfiguredHostPatterns(settings: any): string[] {
  const rawHosts = settings?.skillHttpAllowedHosts;
  const hostsFromSettings =
    Array.isArray(rawHosts)
      ? rawHosts
      : typeof rawHosts === "string"
        ? rawHosts
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        : [];

  const domainPackHosts = (() => {
    const domainId =
      typeof settings?.activeDomainId === "string" && settings.activeDomainId.trim().length > 0
        ? settings.activeDomainId.trim()
        : "";
    if (!domainId) return [] as string[];
    const pack = getInstalledDomainPackManifest(domainId);
    return Array.isArray(pack?.skillHttpAllowedHosts) ? pack!.skillHttpAllowedHosts : [];
  })();

  return [...hostsFromSettings, ...domainPackHosts]
    .map((entry) => normalizeHostPattern(entry))
    .filter((entry): entry is string => !!entry);
}

function hostMatchesPattern(pattern: string, url: URL): boolean {
  const normalizedPattern = pattern.toLowerCase();
  const host = url.host.toLowerCase();
  const hostname = url.hostname.toLowerCase();

  if (normalizedPattern === "*") return true;

  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(2);
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }

  if (normalizedPattern.includes(":")) {
    return host === normalizedPattern;
  }

  return hostname === normalizedPattern;
}

function buildDefaultAllowedHostPatterns(settings: any): string[] {
  const patterns = new Set<string>();

  const matchDataBase = String(settings?.matchDataServerUrl || "").trim();
  if (matchDataBase) {
    try {
      const parsed = new URL(matchDataBase);
      if (parsed.host) patterns.add(parsed.host.toLowerCase());
      if (parsed.hostname) patterns.add(parsed.hostname.toLowerCase());
    } catch {
      // Ignore invalid configured base URL here; request URL resolver handles it later.
    }
  }

  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = String(window.location.hostname).toLowerCase();
    if (host) {
      patterns.add(host);
    }
    const fullHost = String(window.location.host || "").toLowerCase();
    if (fullHost) {
      patterns.add(fullHost);
    }
  }

  patterns.add("localhost");
  patterns.add("127.0.0.1");
  patterns.add("::1");

  return Array.from(patterns);
}

function pathToSegments(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getValueByPath(input: any, path: string): any {
  if (!path) return input;
  const segments = pathToSegments(path);
  let current = input;
  for (const segment of segments) {
    if (current == null || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function resolveTemplateToken(token: string, args: any, settings: any): any {
  const trimmed = token.trim();
  if (!trimmed) return undefined;

  const context = {
    args,
    settings,
    matchDataServerUrl: settings.matchDataServerUrl,
    matchDataApiKey: settings.matchDataApiKey,
  };

  const valueFromContext = getValueByPath(context, trimmed);
  if (valueFromContext !== undefined) {
    return valueFromContext;
  }
  return getValueByPath(args, trimmed);
}

function interpolateTemplateValue(value: any, args: any, settings: any): any {
  if (typeof value === "string") {
    const fullTokenMatch = value.match(/^{{\s*([^{}]+)\s*}}$/);
    if (fullTokenMatch) {
      const resolved = resolveTemplateToken(fullTokenMatch[1], args, settings);
      return resolved === undefined ? null : resolved;
    }
    return value.replace(/{{\s*([^{}]+)\s*}}/g, (_all, rawToken) => {
      const resolved = resolveTemplateToken(String(rawToken), args, settings);
      return resolved == null ? "" : String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateTemplateValue(item, args, settings));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, any>>((acc, [key, val]) => {
      acc[key] = interpolateTemplateValue(val, args, settings);
      return acc;
    }, {});
  }

  return value;
}

function resolveRuntimeUrl(rawUrl: string, matchDataServerUrl: string): string {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("Skill runtime request.url is empty");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const baseUrl = String(matchDataServerUrl || "").trim();
  if (!baseUrl) {
    throw new Error(
      `Skill runtime URL "${trimmed}" is relative but settings.matchDataServerUrl is not configured`,
    );
  }

  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return new URL(normalizedPath, baseUrl).toString();
}

function ensureRuntimeUrlAllowed(rawUrl: string, settings: any): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Skill runtime URL is invalid: ${rawUrl}`);
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    throw new Error(
      `Skill runtime URL protocol must be http/https, got: ${parsed.protocol}`,
    );
  }

  if (protocol === "http:" && !isLocalhost(parsed.hostname)) {
    throw new Error(
      `Insecure HTTP is only allowed for localhost hosts, got: ${parsed.hostname}`,
    );
  }

  if (parsed.username || parsed.password) {
    throw new Error("Skill runtime URL must not contain embedded credentials");
  }

  const configuredPatterns = getConfiguredHostPatterns(settings);
  const defaultPatterns = buildDefaultAllowedHostPatterns(settings);
  const allowedPatterns = [...defaultPatterns, ...configuredPatterns];
  const matched = allowedPatterns.some((pattern) => hostMatchesPattern(pattern, parsed));
  if (!matched) {
    throw new Error(
      `Skill runtime host is not allowed: ${parsed.host}. Configure settings.skillHttpAllowedHosts to allow it.`,
    );
  }

  return parsed;
}

function appendQueryParams(
  rawUrl: string,
  query: Record<string, string | number | boolean> | undefined,
): string {
  if (!query || !isPlainObject(query)) {
    return rawUrl;
  }
  const url = new URL(rawUrl);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function parseResponsePayload(rawText: string): any {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

function buildHttpError(responseStatus: number, payload: any): Error {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return new Error(`HTTP ${responseStatus}: ${payload}`);
  }
  if (isPlainObject(payload)) {
    const message =
      (typeof payload.error === "string" && payload.error) ||
      (typeof payload.message === "string" && payload.message) ||
      (isPlainObject(payload.error) && typeof payload.error.message === "string"
        ? payload.error.message
        : "");
    if (message) {
      return new Error(`HTTP ${responseStatus}: ${message}`);
    }
  }
  return new Error(`HTTP ${responseStatus}`);
}

async function executeHttpJsonRuntime(
  runtime: SkillRuntimeHttpJson,
  args: any,
): Promise<any> {
  const settings = getSettings();
  const interpolatedRequest = interpolateTemplateValue(runtime.request, args, settings) || {};
  const method = String(interpolatedRequest.method || runtime.request.method || "GET").toUpperCase();
  const unresolvedUrl = appendQueryParams(
    resolveRuntimeUrl(interpolatedRequest.url || runtime.request.url, settings.matchDataServerUrl),
    interpolatedRequest.query,
  );
  const resolvedUrl = ensureRuntimeUrlAllowed(unresolvedUrl, settings).toString();

  const headers: Record<string, string> = {};
  const requestHeaders = isPlainObject(interpolatedRequest.headers)
    ? interpolatedRequest.headers
    : {};
  Object.entries(requestHeaders).forEach(([key, value]) => {
    if (typeof value === "string") {
      headers[key] = value;
    }
  });

  const authMode =
    interpolatedRequest.auth === "match_data_api_key" ||
    interpolatedRequest.auth === "none"
      ? interpolatedRequest.auth
      : runtime.request.auth;

  if (
    authMode === "match_data_api_key" &&
    settings.matchDataApiKey &&
    !headers.Authorization
  ) {
    headers.Authorization = `Bearer ${settings.matchDataApiKey}`;
  }

  const timeoutMs = Number(
    interpolatedRequest.timeoutMs || runtime.request.timeoutMs || 0,
  );
  const abortController = new AbortController();
  const timer =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => abortController.abort(), timeoutMs)
      : null;

  const requestInit: RequestInit = {
    method,
    headers,
    signal: abortController.signal,
  };

  if (
    method !== "GET" &&
    method !== "HEAD" &&
    interpolatedRequest.body !== undefined
  ) {
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    requestInit.body =
      typeof interpolatedRequest.body === "string"
        ? interpolatedRequest.body
        : JSON.stringify(interpolatedRequest.body);
  }

  try {
    const response = await fetch(resolvedUrl, requestInit);
    const rawText = await response.text();
    const parsedPayload = parseResponsePayload(rawText);

    if (!response.ok) {
      throw buildHttpError(response.status, parsedPayload);
    }

    let result = parsedPayload;
    const pickPath = runtime.response?.pickPath;
    if (pickPath) {
      const picked = getValueByPath(parsedPayload, pickPath);
      if (picked !== undefined) {
        result = picked;
      } else if (runtime.response?.defaultValue !== undefined) {
        result = runtime.response.defaultValue;
      } else {
        result = null;
      }
    } else if (result === undefined && runtime.response?.defaultValue !== undefined) {
      result = runtime.response.defaultValue;
    }

    return result;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function executeStaticResultRuntime(runtime: SkillRuntimeStaticResult, args: any): any {
  const settings = getSettings();
  return interpolateTemplateValue(runtime.value, args, settings);
}

function getDynamicSkillDeclarations(): FunctionDeclaration[] {
  return listInstalledSkillManifests().map((manifest) => manifest.declaration);
}

export function getAvailableSkills(): FunctionDeclaration[] {
  const declarations = Object.values(BUILTIN_SKILL_DECLARATIONS);
  const installed = getDynamicSkillDeclarations();
  const map = new Map<string, FunctionDeclaration>();

  declarations.forEach((decl) => {
    if (decl?.name) map.set(decl.name, decl);
  });
  installed.forEach((decl) => {
    if (decl?.name) map.set(decl.name, decl);
  });

  return Array.from(map.values());
}

export const availableSkills = getAvailableSkills();

export function hasSkill(skillName: string): boolean {
  if (BUILTIN_SKILL_DECLARATIONS[skillName]) return true;
  return !!getInstalledSkillManifest(skillName);
}

export function getSkillVersion(skillName: string): string | null {
  if (BUILTIN_SKILL_DECLARATIONS[skillName]) {
    return BUILTIN_SKILL_VERSIONS[skillName] || "1.0.0";
  }
  return getInstalledSkillManifest(skillName)?.version || null;
}

async function executeBuiltinSkill(name: string, args: any): Promise<any> {
  const executor = BUILTIN_SKILL_EXECUTORS[name];
  if (!executor) {
    throw new Error(`Unknown builtin skill: ${name}`);
  }
  return await executor(args);
}

async function executeSkillInternal(
  name: string,
  args: any,
  visited: Set<string>,
): Promise<any> {
  if (visited.has(name)) {
    const chain = [...visited, name].join(" -> ");
    throw new Error(`Skill alias cycle detected: ${chain}`);
  }
  visited.add(name);

  if (BUILTIN_SKILL_DECLARATIONS[name]) {
    return await executeBuiltinSkill(name, args);
  }

  const installed = getInstalledSkillManifest(name);
  if (!installed) {
    throw new Error(`Unknown skill: ${name}`);
  }

  if (installed.runtime.mode === "builtin_alias") {
    const targetSkill = installed.runtime.targetSkill;
    if (!targetSkill) {
      throw new Error(`Skill ${name} runtime targetSkill is empty`);
    }
    return await executeSkillInternal(targetSkill, args, visited);
  }

  if (installed.runtime.mode === "http_json") {
    return await executeHttpJsonRuntime(installed.runtime, args);
  }

  if (installed.runtime.mode === "static_result") {
    return executeStaticResultRuntime(installed.runtime, args);
  }

  throw new Error(`Unknown runtime mode for skill: ${name}`);
}

export async function executeSkill(name: string, args: any): Promise<any> {
  return executeSkillInternal(name, args, new Set<string>());
}
