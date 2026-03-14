import type { DomainRuntimeManifest } from '../types';

export const projectOpsRuntimeManifest: DomainRuntimeManifest = {
  domainId: 'project_ops',
  version: '1.0.0',
  displayName: 'Project Ops Runtime Pack',
  supportedIntentTypes: ['analyze', 'schedule', 'explain', 'clarify'],
  supportedEventTypes: ['deadline', 'review', 'handoff'],
  supportedFactorIds: ['fundamental', 'market', 'custom'],
  defaultSequence: ['fundamental', 'market', 'custom', 'prediction'],
};
