import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_MATCHES, type Match } from '@/src/data/matches';
import type { DomainEvent, DomainRuntimePack } from '@/src/domains/runtime/types';
import {
  resolveDomainEventFeed,
  resolveDomainMatchFeed,
} from '@/src/services/domainMatchFeed';

const mocks = vi.hoisted(() => ({
  queryRuntimeDomainEventList: vi.fn(),
  getBuiltinDomainLocalSubjectSnapshots: vi.fn(),
}));

vi.mock('@/src/domains/runtime/sourceQueries', async () => {
  const actual = await vi.importActual<typeof import('@/src/domains/runtime/sourceQueries')>(
    '@/src/domains/runtime/sourceQueries',
  );
  return {
    ...actual,
    queryRuntimeDomainEventList: mocks.queryRuntimeDomainEventList,
  };
});

vi.mock('@/src/services/domains/builtinModules', () => ({
  getBuiltinDomainLocalSubjectSnapshots: mocks.getBuiltinDomainLocalSubjectSnapshots,
}));

function createMatch(id: string, overrides: Partial<Match> = {}): Match {
  return {
    id,
    league: 'Premier League',
    date: '2026-03-12T12:00:00.000Z',
    status: 'upcoming',
    homeTeam: {
      id: `${id}-home`,
      name: `${id} Home`,
      logo: '',
      form: [],
    },
    awayTeam: {
      id: `${id}-away`,
      name: `${id} Away`,
      logo: '',
      form: [],
    },
    stats: {
      possession: { home: 50, away: 50 },
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
    },
    ...overrides,
  };
}

function createEvent(match: Match, overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    domainId: 'football',
    eventType: 'match',
    eventId: match.id,
    title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    subjectRefs: [],
    metadata: {
      matchData: match,
    },
    ...overrides,
  };
}

function createRuntimePack(): DomainRuntimePack {
  return {
    manifest: {
      domainId: 'football',
      version: 'test',
      displayName: 'Football Test Pack',
      supportedIntentTypes: ['query', 'analyze'],
      supportedEventTypes: ['match'],
      supportedFactorIds: [],
    },
    resolver: {
      async resolveIntent() {
        return null;
      },
      async resolveSubjects() {
        return [];
      },
      async resolveEvents() {
        return [];
      },
    },
    queryCatalog: {
      eventListQueryType: 'test_event_list',
      matchListQueryType: 'test_match_list',
    },
    sourceAdapters: [
      {
        id: 'test_adapter',
        supports(input) {
          return input.domainId === 'football' && input.queryType?.startsWith('test_') === true;
        },
        async query() {
          return {};
        },
        normalize(input) {
          if (!Array.isArray(input)) {
            return [];
          }
          return input.map((entry) => createEvent(entry as Match));
        },
      },
    ],
    contextProviders: [],
    tools: [],
  };
}

describe('domain feed helpers', () => {
  let runtimePack: DomainRuntimePack;

  beforeEach(() => {
    runtimePack = createRuntimePack();
    mocks.queryRuntimeDomainEventList.mockReset();
    mocks.getBuiltinDomainLocalSubjectSnapshots.mockReset();
    mocks.getBuiltinDomainLocalSubjectSnapshots.mockReturnValue([]);
  });

  it('returns runtime events when the adapter yields data', async () => {
    const runtimeEvent = createEvent(createMatch('runtime-1'));
    mocks.queryRuntimeDomainEventList.mockResolvedValue([runtimeEvent]);

    const events = await resolveDomainEventFeed({
      domainId: 'football',
      runtimePack,
    });

    expect(events).toEqual([runtimeEvent]);
    expect(mocks.getBuiltinDomainLocalSubjectSnapshots).not.toHaveBeenCalled();
  });

  it('falls back to normalized builtin cases when runtime returns no events', async () => {
    const builtinMatches = [createMatch('builtin-1')];
    mocks.queryRuntimeDomainEventList.mockResolvedValue([]);
    mocks.getBuiltinDomainLocalSubjectSnapshots.mockReturnValue(builtinMatches);

    const events = await resolveDomainEventFeed({
      domainId: 'football',
      runtimePack,
    });

    expect(events).toHaveLength(1);
    expect(events[0].eventId).toBe('builtin-1');
  });

  it('skips runtime queries when allowRuntime is false', async () => {
    const builtinMatches = [createMatch('builtin-local-only')];
    mocks.getBuiltinDomainLocalSubjectSnapshots.mockReturnValue(builtinMatches);

    const events = await resolveDomainEventFeed({
      domainId: 'football',
      allowRuntime: false,
      runtimePack,
    });

    expect(events).toHaveLength(1);
    expect(events[0].eventId).toBe('builtin-local-only');
    expect(mocks.queryRuntimeDomainEventList).not.toHaveBeenCalled();
  });

  it('keeps match-feed compatibility when runtime and builtin cases are empty', async () => {
    mocks.queryRuntimeDomainEventList.mockResolvedValue([]);

    const matches = await resolveDomainMatchFeed({
      domainId: 'unknown-domain',
      runtimePack,
    });

    expect(matches).toHaveLength(MOCK_MATCHES.length);
    expect(matches[0]).toEqual(MOCK_MATCHES[0]);

    matches[0].homeTeam.name = 'mutated';
    expect(MOCK_MATCHES[0].homeTeam.name).not.toBe('mutated');
  });

  it('falls back to builtin cases when runtime lookup fails with a non-abort error', async () => {
    const builtinMatches = [createMatch('builtin-after-error')];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.queryRuntimeDomainEventList.mockRejectedValue(new Error('runtime unavailable'));
    mocks.getBuiltinDomainLocalSubjectSnapshots.mockReturnValue(builtinMatches);

    const matches = await resolveDomainMatchFeed({
      domainId: 'football',
      runtimePack,
    });

    expect(matches).toEqual(builtinMatches);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
