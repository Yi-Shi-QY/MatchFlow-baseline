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

export type SkillRuntime =
  | {
      mode: "builtin_alias";
      targetSkill: string;
    };

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

