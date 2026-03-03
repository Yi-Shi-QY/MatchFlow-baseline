import {
  footballPlannerAutonomousAgent,
  footballPlannerTemplateAgent,
  generalAgent,
  oddsAgent,
  overviewAgent,
  predictionAgent,
  statsAgent,
  tacticalAgent,
} from './domains/football';
import { plannerTemplateAgent } from './planner_template';
import { plannerAutonomousAgent } from './planner_autonomous';
import { tagAgent } from './tag';
import { summaryAgent } from './summary';
import { animationAgent } from './animation';
import { AgentConfig } from './types';
import { buildAnalysisPrompt } from './utils';
import { getInstalledAgentManifest, listInstalledAgentManifests } from '@/src/services/extensions/store';
import { AgentExtensionManifest } from '@/src/services/extensions/types';

export const BUILTIN_AGENTS: Record<string, AgentConfig> = {
  overview: overviewAgent,
  stats: statsAgent,
  tactical: tacticalAgent,
  prediction: predictionAgent,
  general: generalAgent,
  planner_template: plannerTemplateAgent,
  planner_autonomous: plannerAutonomousAgent,
  football_planner_template: footballPlannerTemplateAgent,
  football_planner_autonomous: footballPlannerAutonomousAgent,
  tag: tagAgent,
  summary: summaryAgent,
  odds: oddsAgent,
  animation: animationAgent,
};

export const BUILTIN_AGENT_VERSIONS: Record<string, string> = {
  overview: '1.0.0',
  stats: '1.0.0',
  tactical: '1.0.0',
  prediction: '1.0.0',
  general: '1.0.0',
  planner_template: '1.0.0',
  planner_autonomous: '1.0.0',
  football_planner_template: '1.0.0',
  football_planner_autonomous: '1.0.0',
  tag: '1.0.0',
  summary: '1.0.0',
  odds: '1.0.0',
  animation: '1.0.0',
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
  return getInstalledAgentConfig(id) || BUILTIN_AGENTS['general'];
}

export * from './types';
