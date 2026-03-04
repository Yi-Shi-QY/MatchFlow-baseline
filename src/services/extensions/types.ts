import { FunctionDeclaration } from "@google/genai";

export type ExtensionKind = "agent" | "skill" | "template";

export interface BaseExtensionManifest {
  kind: ExtensionKind;
  id: string;
  version: string;
  name: string;
  description: string;
  minAppVersion?: string;
  updatedAt?: string;
}

export interface AgentExtensionManifest extends BaseExtensionManifest {
  kind: "agent";
  rolePrompt: {
    en: string;
    zh: string;
  };
  skills?: string[];
  contextDependencies?: string[] | "all" | "none";
}

export interface SkillRuntimeBuiltinAlias {
  mode: "builtin_alias";
  targetSkill: string;
}

export interface SkillRuntimeHttpJsonRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  body?: any;
  auth?: "none" | "match_data_api_key";
  timeoutMs?: number;
}

export interface SkillRuntimeHttpJson {
  mode: "http_json";
  request: SkillRuntimeHttpJsonRequest;
  response?: {
    pickPath?: string;
    defaultValue?: any;
  };
}

export interface SkillRuntimeStaticResult {
  mode: "static_result";
  value: any;
}

export type SkillRuntime =
  | SkillRuntimeBuiltinAlias
  | SkillRuntimeHttpJson
  | SkillRuntimeStaticResult;

export interface SkillExtensionManifest extends BaseExtensionManifest {
  kind: "skill";
  declaration: FunctionDeclaration;
  runtime: SkillRuntime;
}

export interface TemplateSegmentManifest {
  title: {
    en: string;
    zh: string;
  };
  focus: {
    en: string;
    zh: string;
  };
  animationType?: string;
  agentType: string;
  contextMode?: string;
  sourceIds?: string[];
}

export interface TemplateExtensionManifest extends BaseExtensionManifest {
  kind: "template";
  rule: string;
  requiredAgents?: string[];
  requiredSkills?: string[];
  segments: TemplateSegmentManifest[];
}

export type ExtensionManifest =
  | AgentExtensionManifest
  | SkillExtensionManifest
  | TemplateExtensionManifest;

export interface InstalledExtensionRecord<T extends ExtensionManifest> {
  manifest: T;
  installedAt: number;
  source: "hub";
  sourceUrl?: string;
}

export interface ExtensionStore {
  schemaVersion: 1;
  agents: Record<string, InstalledExtensionRecord<AgentExtensionManifest>>;
  skills: Record<string, InstalledExtensionRecord<SkillExtensionManifest>>;
  templates: Record<string, InstalledExtensionRecord<TemplateExtensionManifest>>;
}

export interface HubEndpointHint {
  baseUrl?: string;
  apiKey?: string;
  autoInstall?: boolean;
}

export interface ExtensionValidationResult {
  ok: boolean;
  errors: string[];
}

