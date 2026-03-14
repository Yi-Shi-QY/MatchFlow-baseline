import type { DomainRuntimePack } from '../types';
import { createFootballAutomationCapability } from './automation';
import { footballRuntimeContextProviders } from './context';
import { footballRuntimeManagerCapability } from './manager';
import { footballRuntimeManifest } from './manifest';
import { createFootballRuntimeResolver } from './resolver';
import {
  FOOTBALL_MATCH_LIST_QUERY,
  footballRuntimeSourceAdapters,
} from './sourceAdapters';
import { footballRuntimeTools } from './tools';
import { footballRuntimeWorkflowHandlers } from './workflows';

export function createFootballRuntimePack(input: {
  sourceAdapters?: DomainRuntimePack['sourceAdapters'];
  contextProviders?: DomainRuntimePack['contextProviders'];
    } = {}): DomainRuntimePack {
  const sourceAdapters = input.sourceAdapters || footballRuntimeSourceAdapters;
  const contextProviders = input.contextProviders || footballRuntimeContextProviders;
  const runtimePackBase: Omit<DomainRuntimePack, 'automation'> = {
    manifest: footballRuntimeManifest,
    resolver: createFootballRuntimeResolver({
      sourceAdapters,
    }),
    sourceAdapters,
    queryCatalog: {
      eventListQueryType: FOOTBALL_MATCH_LIST_QUERY,
      matchListQueryType: FOOTBALL_MATCH_LIST_QUERY,
    },
    manager: footballRuntimeManagerCapability,
    contextProviders,
    tools: footballRuntimeTools,
    workflows: footballRuntimeWorkflowHandlers,
    legacyAdapters: {
      analysisDomainId: 'football',
      planningDomainId: 'football',
    },
  };

  return {
    ...runtimePackBase,
    automation: createFootballAutomationCapability({
      runtimePack: runtimePackBase,
    }),
  };
}

export const footballRuntimePack: DomainRuntimePack = createFootballRuntimePack();
