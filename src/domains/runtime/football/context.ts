import type { ContextFragment, DomainContextProvider } from '../types';

export const footballRuntimeContextProviders: DomainContextProvider[] = [
  {
    id: 'football_runtime_stub',
    async collect(): Promise<ContextFragment[]> {
      return [];
    },
  },
];
