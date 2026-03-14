import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@/src/data/matches';
import type {
  DomainSourceAdapter,
  RuntimeSessionSnapshot,
  SessionWorkflowStateSnapshot,
} from '@/src/domains/runtime/types';
import { createFootballRuntimePack, footballRuntimePack } from '@/src/domains/runtime/football';
import {
  FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
  parsePendingTaskFromWorkflow,
} from '@/src/domains/runtime/football/tools';
import type { AutomationJob } from '@/src/services/automation/types';
import { queryFootballMatchesViaRuntimeAdapters } from '@/src/domains/runtime/football/sourceAdapters';

const mocks = vi.hoisted(() => ({
  resolveDomainEventFeed: vi.fn(),
  getHistory: vi.fn(),
  getSavedSubjects: vi.fn(),
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

function createAbortedSignal(): AbortSignal {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
}

function createSession(): RuntimeSessionSnapshot {
  return {
    sessionId: 'session_1',
    sessionKey: 'manager:main',
    domainId: 'football',
    title: 'Main Session',
    runtimeDomainVersion: '1.0.0',
    activeWorkflow: null,
  };
}

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

function createEvent(match: Match) {
  return {
    domainId: 'football',
    eventType: 'match',
    eventId: match.id,
    title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    subjectRefs: [],
    metadata: {
      matchData: match,
    },
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

describe('football runtime pack', () => {
  beforeEach(() => {
    mocks.resolveDomainEventFeed.mockReset();
    mocks.getHistory.mockReset();
    mocks.getSavedSubjects.mockReset();

    mocks.resolveDomainEventFeed.mockResolvedValue([]);
    mocks.getHistory.mockResolvedValue([]);
    mocks.getSavedSubjects.mockResolvedValue([]);
  });

  it('exposes football source adapters for pack-level data access', async () => {
    expect(footballRuntimePack.sourceAdapters.length).toBeGreaterThan(0);
    expect(footballRuntimePack.automation).toBeTruthy();

    const matches = await queryFootballMatchesViaRuntimeAdapters();
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].homeTeam.name).toBeTruthy();
  });

  it('wraps the legacy local match query as a runtime tool', async () => {
    const queryTool = footballRuntimePack.tools.find((tool) => tool.id === 'football_query_local_matches');
    expect(queryTool).toBeTruthy();

    const result = await queryTool!.execute({
      input: 'What Premier League matches are on tomorrow?',
      language: 'en',
      session: createSession(),
      intent: {
        domainId: 'football',
        intentType: 'query',
        rawInput: 'What Premier League matches are on tomorrow?',
      },
    });

    expect(result.blocks[0].blockType).toBe('assistant_text');
    expect(result.blocks[0].text).toContain('Premier League');
  });

  it('resolves football events through injected runtime source adapters', async () => {
    const adapterCalls: string[] = [];
    const customAdapters: DomainSourceAdapter[] = [
      {
        id: 'football_empty_override',
        supports(input) {
          return input.domainId === 'football' && input.queryType === 'football_match_list';
        },
        async query() {
          adapterCalls.push('football_empty_override');
          return {
            events: [],
          };
        },
        normalize() {
          return [];
        },
      },
      {
        id: 'football_custom_primary',
        supports(input) {
          return input.domainId === 'football' && input.queryType === 'football_match_list';
        },
        async query() {
          adapterCalls.push('football_custom_primary');
          return {
            events: [
              {
                domainId: 'football',
                eventType: 'match',
                eventId: 'custom-1',
                title: 'Real Madrid vs Barcelona',
                subjectRefs: [],
                metadata: {},
              },
            ],
          };
        },
        normalize() {
          return [];
        },
      },
    ];
    const injectedPack = createFootballRuntimePack({
      sourceAdapters: customAdapters,
    });

    const events = await injectedPack.resolver.resolveEvents(
      {
        domainId: 'football',
        intentType: 'analyze',
        rawInput: 'Analyze Real Madrid vs Barcelona',
      },
      {
        language: 'en',
      },
    );

    expect(adapterCalls).toEqual(['football_empty_override', 'football_custom_primary']);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventId: 'custom-1',
      title: 'Real Madrid vs Barcelona',
    });
    expect(injectedPack.sourceAdapters.map((adapter) => adapter.id)).toEqual([
      'football_empty_override',
      'football_custom_primary',
    ]);
  });

  it('resolves event refs for a concrete football analysis command', async () => {
    const intent = await footballRuntimePack.resolver.resolveIntent(
      'Analyze Real Madrid vs Barcelona',
      {
        language: 'en',
      },
    );

    expect(intent?.intentType).toBe('analyze');
    expect(intent?.targetType).toBe('event');
    expect(intent?.eventRefs?.[0]).toMatchObject({
      eventType: 'match',
      title: 'Real Madrid vs Barcelona',
    });
  });

  it('resolves football events through the runtime resolver', async () => {
    const events = await footballRuntimePack.resolver.resolveEvents(
      {
        domainId: 'football',
        intentType: 'analyze',
        rawInput: 'Analyze Real Madrid vs Barcelona',
      },
      {
        language: 'en',
      },
    );

    expect(events[0]).toMatchObject({
      eventType: 'match',
      title: 'Real Madrid vs Barcelona',
    });
  });

  it('aborts football event resolution when the resolver context signal is cancelled', async () => {
    await expect(
      footballRuntimePack.resolver.resolveEvents(
        {
          domainId: 'football',
          intentType: 'analyze',
          rawInput: 'Analyze Real Madrid vs Barcelona',
        },
        {
          language: 'en',
          signal: createAbortedSignal(),
        },
      ),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('aborts the football query tool when the runtime signal is already cancelled', async () => {
    const queryTool = footballRuntimePack.tools.find((tool) => tool.id === 'football_query_local_matches');
    expect(queryTool).toBeTruthy();

    await expect(
      queryTool!.execute({
        input: 'What Premier League matches are on tomorrow?',
        language: 'en',
        session: createSession(),
        intent: {
          domainId: 'football',
          intentType: 'query',
          rawInput: 'What Premier League matches are on tomorrow?',
        },
        signal: createAbortedSignal(),
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('starts a task-intake workflow when the runtime tool needs clarification', async () => {
    const prepareTool = footballRuntimePack.tools.find(
      (tool) => tool.id === 'football_prepare_task_intake',
    );
    expect(prepareTool).toBeTruthy();

    const result = await prepareTool!.execute({
      input: 'Tonight at 20:00 analyze Real Madrid vs Barcelona',
      language: 'en',
      session: createSession(),
      intent: {
        domainId: 'football',
        intentType: 'analyze',
        rawInput: 'Tonight at 20:00 analyze Real Madrid vs Barcelona',
      },
    });

    expect(result.blocks[0].blockType).toBe('assistant_text');
    expect(result.sessionPatch?.activeWorkflow?.workflowType).toBe(
      FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
    );
  });

  it('resumes the football task-intake workflow through the runtime workflow handler', async () => {
    const workflow = footballRuntimePack.workflows?.[0];
    const workflowState: SessionWorkflowStateSnapshot = {
      workflowType: FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
      stateData: {
        id: 'pending_1',
        sourceText: 'Tonight at 20:00 analyze Real Madrid vs Barcelona',
        composerMode: 'smart',
        drafts: [],
        stage: 'await_factors',
        createdAt: Date.now(),
      },
    };

    expect(parsePendingTaskFromWorkflow(workflowState)?.stage).toBe('await_factors');

    const result = await workflow!.resume({
      input: 'fundamentals and market',
      language: 'en',
      session: createSession(),
      workflow: workflowState,
    });

    expect(result.workflowHandled).toBe(true);
    expect(result.blocks[0].text).toContain('analysis order');
    expect(result.sessionPatch?.activeWorkflow?.workflowType).toBe(
      FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
    );
  });

  it('aborts the football workflow handler when the runtime signal is already cancelled', async () => {
    const workflow = footballRuntimePack.workflows?.[0];
    const workflowState: SessionWorkflowStateSnapshot = {
      workflowType: FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
      stateData: {
        id: 'pending_1',
        sourceText: 'Tonight at 20:00 analyze Real Madrid vs Barcelona',
        composerMode: 'smart',
        drafts: [],
        stage: 'await_factors',
        createdAt: Date.now(),
      },
    };

    await expect(
      workflow!.resume({
        input: 'fundamentals and market',
        language: 'en',
        session: createSession(),
        workflow: workflowState,
        signal: createAbortedSignal(),
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('resolves server_resolve automation targets against the football event feed', async () => {
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

    const targets = await footballRuntimePack.automation!.resolveJobTargets(createJob());

    expect(mocks.resolveDomainEventFeed).toHaveBeenCalledWith(expect.objectContaining({
      domainId: 'football',
    }));
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      domainId: 'football',
      subjectId: runtimeMatch.id,
      subjectType: 'match',
      title: 'Arsenal vs Manchester City',
      subjectDisplay: runtimeMatch,
    });
  });

  it('expands league_query automation selectors through the football automation capability', async () => {
    const premierA = createMatch('premier-a', { league: 'Premier League' });
    const laLiga = createMatch('laliga-a', { league: 'La Liga' });
    const premierB = createMatch('premier-b', { league: 'Premier League' });
    mocks.resolveDomainEventFeed.mockResolvedValue([
      createEvent(premierA),
      createEvent(laLiga),
      createEvent(premierB),
    ]);

    const targets = await footballRuntimePack.automation!.resolveJobTargets(createJob({
      title: 'Analyze Premier League slate',
      targetSelector: {
        mode: 'league_query',
        leagueKey: 'premier_league',
        leagueLabel: 'Premier League',
      },
    }));

    expect(targets.map((target) => target.subjectId)).toEqual([
      'premier-a',
      'premier-b',
    ]);
  });

  it('resolves fixed_subject automation selectors from persisted history before saved subjects', async () => {
    const historyMatch = createMatch('history-1');
    const savedMatch = createMatch('saved-1');
    mocks.getHistory.mockResolvedValue([
      {
        subjectDisplay: historyMatch,
      },
    ]);
    mocks.getSavedSubjects.mockResolvedValue([
      {
        subjectDisplay: savedMatch,
      },
    ]);

    const targets = await footballRuntimePack.automation!.resolveJobTargets(createJob({
      targetSelector: {
        mode: 'fixed_subject',
        subjectId: 'history-1',
        subjectLabel: 'History Match',
      },
    }));

    expect(mocks.getHistory).toHaveBeenCalledWith({
      domainId: 'football',
      subjectId: 'history-1',
    });
    expect(mocks.getSavedSubjects).toHaveBeenCalledWith({
      domainId: 'football',
      subjectId: 'history-1',
    });
    expect(targets).toHaveLength(1);
    expect(targets[0].subjectId).toBe('history-1');
    expect(targets[0].subjectDisplay).toEqual(historyMatch);
  });

  it('creates a synthetic automation target when no concrete football target is available', async () => {
    const target = await footballRuntimePack.automation!.createSyntheticTarget(createJob({
      targetSelector: {
        mode: 'server_resolve',
        queryText: 'Real Madrid vs Barcelona',
        displayLabel: 'Real Madrid vs Barcelona',
      },
    }));

    expect(target).toMatchObject({
      domainId: 'football',
      subjectId: 'football_job-1',
      subjectType: 'match',
      title: 'Real Madrid vs Barcelona',
    });
    expect((target.subjectDisplay as Match & { customInfo?: unknown }).customInfo).toBe(
      'Real Madrid vs Barcelona',
    );
  });
});
