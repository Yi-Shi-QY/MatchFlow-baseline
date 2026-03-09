import { plannerTemplateAgent } from './planner_template';
import { plannerAutonomousAgent } from './planner_autonomous';
import { tagAgent } from './tag';
import { summaryAgent } from './summary';
import { animationAgent } from './animation';
import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';
import { getInstalledAgentManifest, listInstalledAgentManifests } from '@/src/services/extensions/store';
import { AgentExtensionManifest } from '@/src/services/extensions/types';

type DomainAgentModule = {
  DOMAIN_AGENT_ENTRIES?: Record<string, AgentConfig>;
  DOMAIN_AGENT_VERSION_ENTRIES?: Record<string, string>;
};

function collectBuiltinDomainAgentEntries() {
  const modules = import.meta.glob('./domains/*/index.ts', { eager: true }) as Record<
    string,
    DomainAgentModule
  >;
  const agents: Record<string, AgentConfig> = {};
  const versions: Record<string, string> = {};
  const agentSourceById: Record<string, string> = {};
  const versionSourceById: Record<string, string> = {};

  Object.entries(modules)
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    .forEach(([modulePath, module]) => {
      if (module.DOMAIN_AGENT_ENTRIES && typeof module.DOMAIN_AGENT_ENTRIES === 'object') {
        Object.entries(module.DOMAIN_AGENT_ENTRIES).forEach(([rawAgentId, config]) => {
          const agentId = typeof rawAgentId === 'string' ? rawAgentId.trim() : '';
          if (!agentId || !config || typeof config !== 'object') return;
          if (agents[agentId]) {
            throw new Error(
              `[agents] Duplicate domain agent id "${agentId}" in ${modulePath}. ` +
                `Already registered in ${agentSourceById[agentId]}.`,
            );
          }
          agents[agentId] = config;
          agentSourceById[agentId] = modulePath;
        });
      }

      if (
        module.DOMAIN_AGENT_VERSION_ENTRIES &&
        typeof module.DOMAIN_AGENT_VERSION_ENTRIES === 'object'
      ) {
        Object.entries(module.DOMAIN_AGENT_VERSION_ENTRIES).forEach(([rawAgentId, rawVersion]) => {
          const agentId = typeof rawAgentId === 'string' ? rawAgentId.trim() : '';
          const version = typeof rawVersion === 'string' ? rawVersion.trim() : '';
          if (!agentId || !version) return;
          if (versions[agentId]) {
            throw new Error(
              `[agents] Duplicate domain agent version id "${agentId}" in ${modulePath}. ` +
                `Already registered in ${versionSourceById[agentId]}.`,
            );
          }
          versions[agentId] = version;
          versionSourceById[agentId] = modulePath;
        });
      }
    });

  const sharedAgentIds = ['planner_template', 'planner_autonomous', 'tag', 'summary', 'animation'];
  sharedAgentIds.forEach((agentId) => {
    if (agents[agentId]) {
      throw new Error(
        `[agents] Domain agent registration must not override shared agent "${agentId}". ` +
          `Found in ${agentSourceById[agentId]}.`,
      );
    }
    if (versions[agentId]) {
      throw new Error(
        `[agents] Domain agent version registration must not override shared agent "${agentId}". ` +
          `Found in ${versionSourceById[agentId]}.`,
      );
    }
  });

  return { agents, versions };
}

const domainAgentEntries = collectBuiltinDomainAgentEntries();

export const BUILTIN_AGENTS: Record<string, AgentConfig> = {
  planner_template: plannerTemplateAgent,
  planner_autonomous: plannerAutonomousAgent,
  tag: tagAgent,
  summary: summaryAgent,
  animation: animationAgent,
  ...domainAgentEntries.agents,
};

export const BUILTIN_AGENT_VERSIONS: Record<string, string> = {
  planner_template: '1.0.0',
  planner_autonomous: '1.0.0',
  tag: '1.0.0',
  summary: '1.0.0',
  animation: '1.0.0',
  ...domainAgentEntries.versions,
};

function buildManifestAgent(manifest: AgentExtensionManifest): AgentConfig {
  const rolePrompts = {
    en: manifest.rolePrompt.en,
    zh: manifest.rolePrompt.zh,
  };

  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    skills: manifest.skills || [],
    contextDependencies: manifest.contextDependencies || 'all',
    systemPrompt: (context) => {
      const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
      return buildAnalysisPrompt(role, context);
    },
  };
}

function getInstalledAgentConfig(id: string): AgentConfig | null {
  const manifest = getInstalledAgentManifest(id);
  if (!manifest) return null;
  return buildManifestAgent(manifest);
}

export function listInstalledAgentIds(): string[] {
  return listInstalledAgentManifests().map((manifest) => manifest.id);
}

export function hasAgent(id: string): boolean {
  return !!BUILTIN_AGENTS[id] || !!getInstalledAgentManifest(id);
}

export function getAgentVersion(id: string): string | null {
  if (BUILTIN_AGENTS[id]) {
    return BUILTIN_AGENT_VERSIONS[id] || '1.0.0';
  }
  const installed = getInstalledAgentManifest(id);
  return installed?.version || null;
}

export const agents: Record<string, AgentConfig> = BUILTIN_AGENTS;

export function getAgent(id: string): AgentConfig {
  if (BUILTIN_AGENTS[id]) {
    return BUILTIN_AGENTS[id];
  }
  const fallbackAgent =
    BUILTIN_AGENTS['general'] || BUILTIN_AGENTS['planner_template'] || Object.values(BUILTIN_AGENTS)[0];
  return getInstalledAgentConfig(id) || fallbackAgent;
}

export * from './types';
