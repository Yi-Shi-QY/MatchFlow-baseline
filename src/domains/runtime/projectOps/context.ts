import type { ContextFragment, DomainContextProvider } from '../types';

export const projectOpsRuntimeContextProviders: DomainContextProvider[] = [
  {
    id: 'project_ops_runtime_stub',
    async collect(): Promise<ContextFragment[]> {
      return [];
    },
  },
];
