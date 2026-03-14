import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@/src/data/matches';
import type { DomainAutomationResolvedTarget } from '@/src/domains/runtime/automation';
import type { DomainRuntimePack } from '@/src/domains/runtime/types';
import type { AutomationJob } from '@/src/services/automation/types';
import { assembleAutomationJob } from '@/src/services/automation/jobAssembler';

const mocks = vi.hoisted(() => ({
  fetchSubjectAnalysisConfig: vi.fn(),
  resolveSubjectAnalysisConfig: vi.fn(),
  mergeServerPlanningIntoAnalysisPayload: vi.fn(),
  resolveRuntimeDomainPack: vi.fn(),
  resolveJobTargets: vi.fn(),
  createSyntheticTarget: vi.fn(),
}));

vi.mock('@/src/services/analysisConfig', () => ({
  fetchSubjectAnalysisConfig: mocks.fetchSubjectAnalysisConfig,
  resolveSubjectAnalysisConfig: mocks.resolveSubjectAnalysisConfig,
  mergeServerPlanningIntoAnalysisPayload: mocks.mergeServerPlanningIntoAnalysisPayload,
}));

vi.mock('@/src/domains/runtime/registry', () => ({
  resolveRuntimeDomainPack: mocks.resolveRuntimeDomainPack,
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

function createResolvedTarget(
  match: Match,
  overrides: Partial<DomainAutomationResolvedTarget> = {},
): DomainAutomationResolvedTarget {
  return {
    domainId: 'football',
    subjectId: match.id,
    subjectType: 'match',
    title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    subjectDisplay: match,
    ...overrides,
  };
}

function createRuntimePack(): DomainRuntimePack {
  return {
    manifest: {
      domainId: 'football',
      version: 'test',
      displayName: 'Football Test Pack',
      supportedIntentTypes: ['analyze'],
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
    sourceAdapters: [],
    automation: {
      resolveJobTargets: mocks.resolveJobTargets,
      createSyntheticTarget: mocks.createSyntheticTarget,
    },
    contextProviders: [],
    tools: [],
  };
}

describe('assembleAutomationJob', () => {
  beforeEach(() => {
    mocks.fetchSubjectAnalysisConfig.mockReset();
    mocks.resolveSubjectAnalysisConfig.mockReset();
    mocks.mergeServerPlanningIntoAnalysisPayload.mockReset();
    mocks.resolveRuntimeDomainPack.mockReset();
    mocks.resolveJobTargets.mockReset();
    mocks.createSyntheticTarget.mockReset();

    mocks.fetchSubjectAnalysisConfig.mockResolvedValue(null);
    mocks.resolveSubjectAnalysisConfig.mockResolvedValue(null);
    mocks.mergeServerPlanningIntoAnalysisPayload.mockImplementation((match) => match);
    mocks.resolveRuntimeDomainPack.mockReturnValue(createRuntimePack());
    mocks.resolveJobTargets.mockResolvedValue([]);
  });

  it('delegates single-target resolution to the runtime pack automation capability', async () => {
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
    mocks.resolveJobTargets.mockResolvedValue([createResolvedTarget(runtimeMatch)]);

    const job = createJob();
    const assembled = await assembleAutomationJob(job);

    expect(mocks.resolveRuntimeDomainPack).toHaveBeenCalledWith('football');
    expect(mocks.resolveJobTargets).toHaveBeenCalledWith(job);
    expect(mocks.fetchSubjectAnalysisConfig).toHaveBeenCalledWith({
      domainId: 'football',
      subjectId: runtimeMatch.id,
      subjectType: 'match',
    });
    expect(assembled.targets).toHaveLength(1);
    expect(assembled.targets[0]).toMatchObject({
      subjectId: runtimeMatch.id,
      subjectType: 'match',
      title: 'Arsenal vs Manchester City',
      match: runtimeMatch,
    });
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

  it('preserves multi-target expansion returned by the runtime pack automation capability', async () => {
    const premierA = createMatch('premier-a', { league: 'Premier League' });
    const premierB = createMatch('premier-b', { league: 'Premier League' });
    mocks.resolveJobTargets.mockResolvedValue([
      createResolvedTarget(premierA),
      createResolvedTarget(premierB),
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
    expect(mocks.createSyntheticTarget).not.toHaveBeenCalled();
  });

  it('falls back to the runtime pack synthetic target when no concrete target resolves', async () => {
    const syntheticMatch = {
      ...createMatch('football_job-1'),
      customInfo: 'Arsenal vs Manchester City',
    };
    mocks.createSyntheticTarget.mockResolvedValue(
      createResolvedTarget(syntheticMatch, {
        subjectId: 'football_job-1',
        title: 'Arsenal vs Manchester City',
      }),
    );

    const assembled = await assembleAutomationJob(createJob());

    expect(mocks.resolveJobTargets).toHaveBeenCalledTimes(1);
    expect(mocks.createSyntheticTarget).toHaveBeenCalledWith(expect.objectContaining({
      id: 'job-1',
      domainId: 'football',
    }));
    expect(assembled.targets).toHaveLength(1);
    expect(assembled.targets[0].subjectId).toBe('football_job-1');
    expect(assembled.targets[0].dataToAnalyze.customInfo).toBe('Arsenal vs Manchester City');
    expect(assembled.targetSnapshot).toEqual({
      domainId: 'football',
      subjectId: 'football_job-1',
      subjectType: 'match',
      title: 'Arsenal vs Manchester City',
    });
  });
});
