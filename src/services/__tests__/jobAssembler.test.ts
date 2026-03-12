import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@/src/data/matches';
import type { DomainEvent } from '@/src/domains/runtime/types';
import type { AutomationJob } from '@/src/services/automation/types';
import { assembleAutomationJob } from '@/src/services/automation/jobAssembler';

const mocks = vi.hoisted(() => ({
  fetchSubjectAnalysisConfig: vi.fn(),
  resolveSubjectAnalysisConfig: vi.fn(),
  mergeServerPlanningIntoAnalysisPayload: vi.fn(),
  resolveDomainEventFeed: vi.fn(),
  getHistory: vi.fn(),
  getSavedSubjects: vi.fn(),
}));

vi.mock('@/src/services/analysisConfig', () => ({
  fetchSubjectAnalysisConfig: mocks.fetchSubjectAnalysisConfig,
  resolveSubjectAnalysisConfig: mocks.resolveSubjectAnalysisConfig,
  mergeServerPlanningIntoAnalysisPayload: mocks.mergeServerPlanningIntoAnalysisPayload,
}));

vi.mock('@/src/services/domainMatchFeed', () => ({
  resolveDomainEventFeed: mocks.resolveDomainEventFeed,
}));

vi.mock('@/src/services/history', () => ({
  getHistory: mocks.getHistory,
}));

vi.mock('@/src/services/savedSubjects', () => ({
  getSavedSubjects: mocks.getSavedSubjects,
}));

function createMatch(
  id: string,
  overrides: Partial<Match> = {},
): Match {
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

function createJob(overrides: Partial<AutomationJob> = {}): AutomationJob {
  return {
    id: 'job-1',
    title: 'Analyze Arsenal vs Manchester City',
    sourceDraftId: 'draft-1',
    sourceRuleId: undefined,
    domainId: 'football',
    domainPackVersion: undefined,
    templateId: undefined,
    triggerType: 'one_time',
    targetSelector: {
      mode: 'server_resolve',
      queryText: 'Arsenal vs Manchester City',
      displayLabel: 'Arsenal vs Manchester City',
    },
    targetSnapshot: undefined,
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: false,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    analysisProfile: undefined,
    scheduledFor: '2026-03-12T12:00:00.000Z',
    state: 'pending',
    retryCount: 0,
    maxRetries: 2,
    retryAfter: null,
    recoveryWindowEndsAt: null,
    createdAt: 1,
    updatedAt: 1,
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

describe('assembleAutomationJob', () => {
  beforeEach(() => {
    mocks.fetchSubjectAnalysisConfig.mockReset();
    mocks.resolveSubjectAnalysisConfig.mockReset();
    mocks.mergeServerPlanningIntoAnalysisPayload.mockReset();
    mocks.resolveDomainEventFeed.mockReset();
    mocks.getHistory.mockReset();
    mocks.getSavedSubjects.mockReset();

    mocks.fetchSubjectAnalysisConfig.mockResolvedValue(null);
    mocks.resolveSubjectAnalysisConfig.mockResolvedValue(null);
    mocks.mergeServerPlanningIntoAnalysisPayload.mockImplementation((match) => match);
    mocks.resolveDomainEventFeed.mockResolvedValue([]);
    mocks.getHistory.mockResolvedValue([]);
    mocks.getSavedSubjects.mockResolvedValue([]);
  });

  it('resolves server_resolve selectors against runtime-backed domain events', async () => {
    const runtimeMatch = createMatch('runtime-arsenal-city', {
      homeTeam: {
        id: 'arsenal',
        name: 'Arsenal',
        logo: '',
        form: [],
      },
      awayTeam: {
        id: 'man-city',
        name: 'Manchester City',
        logo: '',
        form: [],
      },
    });
    mocks.resolveDomainEventFeed.mockResolvedValue([createEvent(runtimeMatch)]);

    const assembled = await assembleAutomationJob(createJob());

    expect(mocks.resolveDomainEventFeed).toHaveBeenCalledWith({ domainId: 'football' });
    expect(mocks.fetchSubjectAnalysisConfig).toHaveBeenCalledWith({
      domainId: 'football',
      subjectId: runtimeMatch.id,
      subjectType: 'match',
    });
    expect(assembled.targets).toHaveLength(1);
    expect(assembled.targets[0].subjectId).toBe(runtimeMatch.id);
    expect(assembled.targetSnapshot).toEqual({
      domainId: 'football',
      subjectId: runtimeMatch.id,
      subjectType: 'match',
      title: 'Arsenal vs Manchester City',
    });
    expect(assembled.targets[0].dataToAnalyze.sourceContext?.automation).toMatchObject({
      jobId: 'job-1',
      triggerType: 'one_time',
    });
  });

  it('expands league_query selectors from the runtime-backed event feed', async () => {
    const premierA = createMatch('premier-a', { league: 'Premier League' });
    const laLiga = createMatch('laliga-a', { league: 'La Liga' });
    const premierB = createMatch('premier-b', { league: 'Premier League' });
    mocks.resolveDomainEventFeed.mockResolvedValue([
      createEvent(premierA),
      createEvent(laLiga),
      createEvent(premierB),
    ]);

    const assembled = await assembleAutomationJob(createJob({
      title: 'Analyze Premier League slate',
      targetSelector: {
        mode: 'league_query',
        leagueKey: 'premier_league',
        leagueLabel: 'Premier League',
      },
    }));

    expect(assembled.targets.map((target) => target.subjectId)).toEqual([
      'premier-a',
      'premier-b',
    ]);
    expect(assembled.targetSnapshot).toEqual([
      {
        domainId: 'football',
        subjectId: 'premier-a',
        subjectType: 'match',
        title: 'premier-a Home vs premier-a Away',
      },
      {
        domainId: 'football',
        subjectId: 'premier-b',
        subjectType: 'match',
        title: 'premier-b Home vs premier-b Away',
      },
    ]);
  });
});
