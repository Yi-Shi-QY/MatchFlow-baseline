import type { DomainRuntimePack } from '../types';
import { footballRuntimeContextProviders } from './context';
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

  return {
    manifest: footballRuntimeManifest,
    resolver: createFootballRuntimeResolver({
      sourceAdapters,
    }),
    sourceAdapters,
    queryCatalog: {
      eventListQueryType: FOOTBALL_MATCH_LIST_QUERY,
      matchListQueryType: FOOTBALL_MATCH_LIST_QUERY,
    },
    contextProviders,
    tools: footballRuntimeTools,
    workflows: footballRuntimeWorkflowHandlers,
    legacyAdapters: {
      analysisDomainId: 'football',
      planningDomainId: 'football',
    },
  };
}

export const footballRuntimePack: DomainRuntimePack = createFootballRuntimePack();
