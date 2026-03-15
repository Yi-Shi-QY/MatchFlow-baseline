import { describe, expect, it } from 'vitest';
import type {
  AnalysisIntent,
  DomainEvent,
  DomainResolver,
  DomainRuntimePack,
  DomainSubject,
} from '@/src/domains/runtime/types';
import { resolveRuntimeManagerRoutingResult } from '@/src/services/manager/runtimeIntentRouter';

function createSubject(domainId: string, label: string): DomainSubject {
  return {
    domainId,
    subjectType: 'subject',
    subjectId: `${domainId}_subject_1`,
    label,
  };
}

function createEvent(domainId: string, title: string): DomainEvent {
  return {
    domainId,
    eventType: 'event',
    eventId: `${domainId}_event_1`,
    title,
    subjectRefs: [],
  };
}

function createResolver(
  resolveIntent: DomainResolver['resolveIntent'],
): DomainResolver {
  return {
    resolveIntent,
    resolveSubjects: async () => [],
    resolveEvents: async () => [],
  };
}

function createRuntimePack(
  domainId: string,
  resolveIntent: DomainResolver['resolveIntent'],
): DomainRuntimePack {
  return {
    manifest: {
      domainId,
      version: '1.0.0',
      displayName: domainId,
      supportedIntentTypes: ['query', 'analyze', 'schedule', 'explain', 'clarify'],
      supportedEventTypes: [],
      supportedFactorIds: [],
    },
    resolver: createResolver(resolveIntent),
    sourceAdapters: [],
    contextProviders: [],
    tools: [],
  };
}

function buildIntent(
  domainId: string,
  input: string,
  overrides: Partial<AnalysisIntent> = {},
): AnalysisIntent {
  return {
    domainId,
    intentType: 'analyze',
    rawInput: input,
    ...overrides,
  };
}

describe('runtime manager routing', () => {
  it('returns a single-domain result for football-only input', async () => {
    const result = await resolveRuntimeManagerRoutingResult({
      input: 'Analyze Real Madrid vs Barcelona tonight',
      language: 'en',
      runtimePacks: [
        createRuntimePack('football', async (input) =>
          buildIntent('football', input, {
            targetType: 'event',
            eventRefs: [createEvent('football', 'Real Madrid vs Barcelona')],
          }),
        ),
        createRuntimePack('project_ops', async () => null),
      ],
    });

    expect(result.mode).toBe('single');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      domainId: 'football',
      sourceText: 'Analyze Real Madrid vs Barcelona tonight',
    });
    expect(result.items[0].confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.items[0].reason).toContain('event');
  });

  it('returns a single-domain result for project-ops input', async () => {
    const result = await resolveRuntimeManagerRoutingResult({
      input: 'Review Q2 mobile launch blockers',
      language: 'en',
      runtimePacks: [
        createRuntimePack('football', async () => null),
        createRuntimePack('project_ops', async (input) =>
          buildIntent('project_ops', input, {
            targetType: 'subject',
            subjectRefs: [createSubject('project_ops', 'Q2 mobile launch')],
          }),
        ),
      ],
    });

    expect(result.mode).toBe('single');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      domainId: 'project_ops',
      sourceText: 'Review Q2 mobile launch blockers',
    });
    expect(result.items[0].confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.items[0].reason).toContain('subject');
  });

  it('returns a composite result when multiple domains have strong evidence', async () => {
    const result = await resolveRuntimeManagerRoutingResult({
      input: 'Analyze Real Madrid vs Barcelona and review Q2 mobile launch blockers',
      language: 'en',
      runtimePacks: [
        createRuntimePack('football', async (input) =>
          buildIntent('football', input, {
            targetType: 'event',
            eventRefs: [createEvent('football', 'Real Madrid vs Barcelona')],
          }),
        ),
        createRuntimePack('project_ops', async (input) =>
          buildIntent('project_ops', input, {
            targetType: 'subject',
            subjectRefs: [createSubject('project_ops', 'Q2 mobile launch')],
          }),
        ),
      ],
    });

    expect(result.mode).toBe('composite');
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.domainId)).toEqual(['football', 'project_ops']);
    expect(result.items.every((item) => item.confidence >= 0.7)).toBe(true);
  });

  it('returns an ambiguous result when multiple domains only have weak generic evidence', async () => {
    const result = await resolveRuntimeManagerRoutingResult({
      input: 'Analyze this for me',
      language: 'en',
      runtimePacks: [
        createRuntimePack('football', async (input) =>
          buildIntent('football', input, {
            targetType: 'event',
          }),
        ),
        createRuntimePack('project_ops', async (input) =>
          buildIntent('project_ops', input, {
            targetType: 'subject',
          }),
        ),
      ],
    });

    expect(result.mode).toBe('ambiguous');
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.confidence < 0.7)).toBe(true);
  });
});
