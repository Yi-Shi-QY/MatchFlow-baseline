import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '@/src/domains/runtime/types';
import { executeManagerQueryLocalMatches } from '@/src/services/manager/toolRegistry';

const mocks = vi.hoisted(() => ({
  resolveDomainEventFeed: vi.fn(),
}));

vi.mock('@/src/services/domainMatchFeed', () => ({
  resolveDomainEventFeed: mocks.resolveDomainEventFeed,
}));

function createEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    domainId: 'football',
    eventType: 'match',
    eventId: 'm1',
    title: 'Arsenal vs Manchester City',
    subjectRefs: [],
    startTime: '2026-03-12T12:00:00.000Z',
    status: 'upcoming',
    metadata: {
      league: 'Premier League',
      kickoffAt: '2026-03-12T12:00:00.000Z',
      matchData: {
        id: 'm1',
        league: 'Premier League',
        date: '2026-03-12T12:00:00.000Z',
        status: 'upcoming',
        homeTeam: {
          id: 'h1',
          name: 'Arsenal',
          logo: '',
          form: [],
        },
        awayTeam: {
          id: 'a1',
          name: 'Manchester City',
          logo: '',
          form: [],
        },
      },
    },
    ...overrides,
  };
}

describe('manager tool registry', () => {
  beforeEach(() => {
    mocks.resolveDomainEventFeed.mockReset();
    mocks.resolveDomainEventFeed.mockResolvedValue([]);
  });

  it('queries local matches through the shared domain event feed', async () => {
    mocks.resolveDomainEventFeed.mockResolvedValue([createEvent()]);

    const result = await executeManagerQueryLocalMatches({
      sourceText: 'What Premier League matches are on today?',
      domainId: 'football',
      language: 'en',
    });

    expect(mocks.resolveDomainEventFeed).toHaveBeenCalledWith({
      domainId: 'football',
      filters: {
        leagueTerms: ['Premier League'],
        matchDate: expect.any(String),
        statuses: undefined,
      },
      signal: undefined,
    });
    expect(result.agentText).toContain('Arsenal vs Manchester City');
    expect(result.messageKind).toBe('text');
  });

  it('returns an empty-result message when the shared event feed has no match records', async () => {
    const result = await executeManagerQueryLocalMatches({
      sourceText: 'What La Liga matches are on today?',
      domainId: 'football',
      language: 'en',
    });

    expect(result.agentText).toContain('found no');
  });
});
