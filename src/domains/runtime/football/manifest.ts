import type { DomainRuntimeManifest } from '../types';

export const footballRuntimeManifest: DomainRuntimeManifest = {
  domainId: 'football',
  version: '1.0.0',
  displayName: 'Football Runtime Pack',
  supportedIntentTypes: ['query', 'analyze', 'schedule', 'explain', 'clarify'],
  supportedEventTypes: ['match'],
  supportedFactorIds: ['fundamental', 'market', 'custom'],
  defaultSequence: ['fundamental', 'market', 'custom', 'prediction'],
};
