import type { DomainRuntimePack } from '../types';
import { projectOpsAutomationCapability } from './automation';
import { projectOpsRuntimeContextProviders } from './context';
import { projectOpsRuntimeManagerCapability } from './manager';
import { projectOpsRuntimeManifest } from './manifest';
import { projectOpsRuntimeResolver } from './resolver';
import { projectOpsRuntimeTools } from './tools';
import { projectOpsRuntimeWorkflowHandlers } from './workflows';

export function createProjectOpsRuntimePack(): DomainRuntimePack {
  return {
    manifest: projectOpsRuntimeManifest,
    resolver: projectOpsRuntimeResolver,
    sourceAdapters: [],
    automation: projectOpsAutomationCapability,
    manager: projectOpsRuntimeManagerCapability,
    contextProviders: projectOpsRuntimeContextProviders,
    tools: projectOpsRuntimeTools,
    workflows: projectOpsRuntimeWorkflowHandlers,
    legacyAdapters: {
      analysisDomainId: 'project_ops',
      planningDomainId: 'project_ops',
    },
  };
}

export const projectOpsRuntimePack: DomainRuntimePack = createProjectOpsRuntimePack();
