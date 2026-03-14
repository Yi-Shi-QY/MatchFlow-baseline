import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveAnalysis } from '@/src/contexts/analysis/types';
import type { AutomationJob } from '@/src/services/automation/types';
import { executeAutomationJob } from '@/src/services/automation/executor';

const mocks = vi.hoisted(() => ({
  saveAutomationJob: vi.fn(),
  listAutomationJobs: vi.fn(),
  saveAutomationRun: vi.fn(),
  assembleAutomationJob: vi.fn(),
  executeAnalysisRun: vi.fn(),
  notifyAutomationRunStarted: vi.fn(),
  notifyAutomationRunCompleted: vi.fn(),
  notifyAutomationRunFailed: vi.fn(),
  writeAutomationLifecycleToManagerConversation: vi.fn(),
}));

vi.mock('@/src/services/automation/jobStore', () => ({
  saveAutomationJob: mocks.saveAutomationJob,
  listAutomationJobs: mocks.listAutomationJobs,
}));

vi.mock('@/src/services/automation/runStore', () => ({
  saveAutomationRun: mocks.saveAutomationRun,
}));

vi.mock('@/src/services/automation/jobAssembler', () => ({
  assembleAutomationJob: mocks.assembleAutomationJob,
}));

vi.mock('@/src/services/automation/notifications', () => ({
  notifyAutomationRunStarted: mocks.notifyAutomationRunStarted,
  notifyAutomationRunCompleted: mocks.notifyAutomationRunCompleted,
  notifyAutomationRunFailed: mocks.notifyAutomationRunFailed,
}));

vi.mock('@/src/services/manager-workspace/automationWritebackBridge', () => ({
  writeAutomationLifecycleToManagerConversation:
    mocks.writeAutomationLifecycleToManagerConversation,
}));

vi.mock('@/src/services/automation/executionRuntime', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/automation/executionRuntime')>(
    '@/src/services/automation/executionRuntime',
  );
  return {
    ...actual,
    executeAnalysisRun: mocks.executeAnalysisRun,
  };
});

function createJob(overrides: Partial<AutomationJob> = {}): AutomationJob {
  return {
    id: 'job-1',
    title: 'Analyze Arsenal vs Man City',
    sourceDraftId: 'draft-1',
    sourceRuleId: undefined,
    domainId: 'football',
    domainPackVersion: undefined,
    templateId: undefined,
    triggerType: 'one_time',
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'm1',
      subjectLabel: 'Arsenal vs Man City',
    },
    targetSnapshot: undefined,
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: false,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    scheduledFor: '2026-03-11T12:00:00.000Z',
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

function createSnapshot(overrides: Partial<ActiveAnalysis> = {}): ActiveAnalysis {
  return {
    subjectRef: {
      domainId: 'football',
      subjectId: 'm1',
      subjectType: 'match',
    },
    domainId: 'football',
    subjectId: 'm1',
    subjectType: 'match',
    subjectSnapshot: undefined,
    match: {
      id: 'm1',
      league: 'Premier League',
      date: '2026-03-11T12:00:00.000Z',
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
      stats: {
        possession: { home: 50, away: 50 },
        shots: { home: 0, away: 0 },
        shotsOnTarget: { home: 0, away: 0 },
      },
    },
    dataToAnalyze: {},
    plan: [],
    includeAnimations: true,
    thoughts: '',
    parsedStream: null,
    collapsedSegments: {},
    isAnalyzing: false,
    analysis: null,
    error: null,
    planTotalSegments: 0,
    planCompletedSegments: 0,
    runtimeStatus: null,
    runMetrics: {
      runId: 'run-1',
      startedAt: 10,
      endedAt: 20,
      elapsedMs: 10,
      currentProvider: 'openai',
      currentModel: 'gpt-5',
      modelsUsed: ['openai:gpt-5'],
      requestCount: 1,
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      tokenSource: 'provider',
      toolCallTotal: 0,
      toolCallSuccess: 0,
      toolCallFailed: 0,
      updatedAt: 20,
    },
    ...overrides,
  };
}

describe('executeAutomationJob', () => {
  beforeEach(() => {
    mocks.saveAutomationJob.mockReset();
    mocks.listAutomationJobs.mockReset();
    mocks.saveAutomationRun.mockReset();
    mocks.assembleAutomationJob.mockReset();
    mocks.executeAnalysisRun.mockReset();
    mocks.notifyAutomationRunStarted.mockReset();
    mocks.notifyAutomationRunCompleted.mockReset();
    mocks.notifyAutomationRunFailed.mockReset();
    mocks.writeAutomationLifecycleToManagerConversation.mockReset();
    mocks.listAutomationJobs.mockResolvedValue([]);
  });

  it('persists running and completed states for a successful automation job', async () => {
    const job = createJob();
    mocks.assembleAutomationJob.mockResolvedValue({
      job,
      targets: [
        {
          jobId: job.id,
          domainId: 'football',
          subjectId: 'm1',
          subjectType: 'match',
          title: 'Arsenal vs Manchester City',
          match: createSnapshot().match,
          dataToAnalyze: {},
        },
      ],
      targetSnapshot: {
        domainId: 'football',
        subjectId: 'm1',
        subjectType: 'match',
        title: 'Arsenal vs Manchester City',
      },
    });
    mocks.executeAnalysisRun.mockResolvedValue({
      status: 'completed',
      snapshot: createSnapshot(),
      historyId: 'football::m1',
      errorMessage: null,
    });
    const onStateChange = vi.fn();

    const result = await executeAutomationJob(job, { onStateChange });

    expect(result.status).toBe('completed');
    expect(result.historyIds).toEqual(['football::m1']);
    expect(mocks.saveAutomationJob).toHaveBeenCalled();
    expect(mocks.saveAutomationRun).toHaveBeenCalled();

    const lastSavedJob = mocks.saveAutomationJob.mock.calls.at(-1)?.[0] as AutomationJob;
    expect(lastSavedJob.state).toBe('completed');

    const lastSavedRun = mocks.saveAutomationRun.mock.calls.at(-1)?.[0];
    expect(lastSavedRun.state).toBe('completed');
    expect(lastSavedRun.resultHistoryId).toBe('football::m1');
    expect(lastSavedRun.provider).toBe('openai');
    expect(lastSavedRun.totalTokens).toBe(300);
    expect(mocks.notifyAutomationRunStarted).not.toHaveBeenCalled();
    expect(mocks.notifyAutomationRunCompleted).toHaveBeenCalledTimes(1);
    expect(mocks.notifyAutomationRunFailed).not.toHaveBeenCalled();
    expect(
      mocks.writeAutomationLifecycleToManagerConversation.mock.calls.map(
        (call) => call[0].phase,
      ),
    ).toEqual(['started', 'completed']);
    expect(
      mocks.writeAutomationLifecycleToManagerConversation.mock.calls.find(
        (call) => call[0].phase === 'completed',
      )?.[0].memoryCandidates || [],
    ).toEqual([]);

    expect(onStateChange.mock.calls.map((call) => call[0].phase)).toEqual([
      'started',
      'completed',
    ]);

    expect(mocks.executeAnalysisRun).toHaveBeenCalled();
    const firstArgs = mocks.executeAnalysisRun.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstArgs.includeAnimations).toBe(false);
    expect(firstArgs.resumeMode).toBe('enabled');
    expect(firstArgs.isResume).toBe(false);
  });

  it('uses resume on retry executions', async () => {
    const job = createJob({
      retryCount: 1,
      state: 'failed_retryable',
      retryAfter: '2026-03-11T12:05:00.000Z',
    });
    mocks.assembleAutomationJob.mockResolvedValue({
      job,
      targets: [
        {
          jobId: job.id,
          domainId: 'football',
          subjectId: 'm1',
          subjectType: 'match',
          title: 'Arsenal vs Manchester City',
          match: createSnapshot().match,
          dataToAnalyze: {},
        },
      ],
      targetSnapshot: {
        domainId: 'football',
        subjectId: 'm1',
        subjectType: 'match',
        title: 'Arsenal vs Manchester City',
      },
    });
    mocks.executeAnalysisRun.mockResolvedValue({
      status: 'completed',
      snapshot: createSnapshot(),
      historyId: 'football::m1',
      errorMessage: null,
    });

    await executeAutomationJob(job);

    const firstArgs = mocks.executeAnalysisRun.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstArgs.resumeMode).toBe('enabled');
    expect(firstArgs.isResume).toBe(true);
    expect(firstArgs.includeAnimations).toBe(false);
  });

  it('marks failed executions as retryable when retries remain', async () => {
    const job = createJob();
    mocks.assembleAutomationJob.mockResolvedValue({
      job,
      targets: [
        {
          jobId: job.id,
          domainId: 'football',
          subjectId: 'm1',
          subjectType: 'match',
          title: 'Arsenal vs Manchester City',
          match: createSnapshot().match,
          dataToAnalyze: {},
        },
      ],
      targetSnapshot: {
        domainId: 'football',
        subjectId: 'm1',
        subjectType: 'match',
        title: 'Arsenal vs Manchester City',
      },
    });
    mocks.executeAnalysisRun.mockResolvedValue({
      status: 'failed',
      snapshot: createSnapshot({
        error: 'Provider timeout',
      }),
      historyId: null,
      errorMessage: 'Provider timeout',
    });

    const result = await executeAutomationJob(job);

    expect(result.status).toBe('failed');

    const lastSavedJob = mocks.saveAutomationJob.mock.calls.at(-1)?.[0] as AutomationJob;
    expect(lastSavedJob.state).toBe('failed_retryable');
    expect(lastSavedJob.retryCount).toBe(1);
    expect(lastSavedJob.retryAfter).toBeTruthy();

    const lastSavedRun = mocks.saveAutomationRun.mock.calls.at(-1)?.[0];
    expect(lastSavedRun.state).toBe('failed');
    expect(lastSavedRun.errorMessage).toBe('Provider timeout');
    expect(mocks.notifyAutomationRunCompleted).not.toHaveBeenCalled();
    expect(mocks.notifyAutomationRunFailed).toHaveBeenCalledTimes(1);
    expect(
      mocks.writeAutomationLifecycleToManagerConversation.mock.calls.map(
        (call) => call[0].phase,
      ),
    ).toEqual(['started', 'failed']);
  });

  it('notifies when a run starts if the job policy enables start notifications', async () => {
    const job = createJob({
      notificationPolicy: {
        notifyOnClarification: true,
        notifyOnStart: true,
        notifyOnComplete: false,
        notifyOnFailure: false,
      },
    });
    mocks.assembleAutomationJob.mockResolvedValue({
      job,
      targets: [
        {
          jobId: job.id,
          domainId: 'football',
          subjectId: 'm1',
          subjectType: 'match',
          title: 'Arsenal vs Manchester City',
          match: createSnapshot().match,
          dataToAnalyze: {},
        },
      ],
      targetSnapshot: {
        domainId: 'football',
        subjectId: 'm1',
        subjectType: 'match',
        title: 'Arsenal vs Manchester City',
      },
    });
    mocks.executeAnalysisRun.mockResolvedValue({
      status: 'completed',
      snapshot: createSnapshot(),
      historyId: 'football::m1',
      errorMessage: null,
    });

    await executeAutomationJob(job);

    expect(mocks.notifyAutomationRunStarted).toHaveBeenCalledTimes(1);
    expect(mocks.notifyAutomationRunCompleted).not.toHaveBeenCalled();
    expect(mocks.notifyAutomationRunFailed).not.toHaveBeenCalled();
  });

  it('emits conservative memory candidates when a recurring automation reveals stable preferences', async () => {
    const job = createJob({
      id: 'job-schedule-1',
      sourceRuleId: 'rule-1',
      triggerType: 'schedule',
      targetSelector: {
        mode: 'league_query',
        leagueKey: 'premier_league',
        leagueLabel: 'Premier League',
      },
      analysisProfile: {
        selectedSourceIds: ['market', 'custom'],
        sequencePreference: ['market', 'fundamental', 'prediction'],
      },
      state: 'pending',
    });
    mocks.assembleAutomationJob.mockResolvedValue({
      job,
      targets: [
        {
          jobId: job.id,
          domainId: 'football',
          subjectId: 'm1',
          subjectType: 'match',
          title: 'Arsenal vs Manchester City',
          match: createSnapshot().match,
          dataToAnalyze: {},
        },
      ],
      targetSnapshot: [
        {
          domainId: 'football',
          subjectId: 'm1',
          subjectType: 'match',
          title: 'Arsenal vs Manchester City',
        },
      ],
    });
    mocks.executeAnalysisRun.mockResolvedValue({
      status: 'completed',
      snapshot: createSnapshot(),
      historyId: 'football::m1',
      errorMessage: null,
    });
    mocks.listAutomationJobs.mockResolvedValue([
      createJob({
        id: 'job-schedule-prev',
        sourceRuleId: 'rule-1',
        triggerType: 'schedule',
        targetSelector: {
          mode: 'league_query',
          leagueKey: 'premier_league',
          leagueLabel: 'Premier League',
        },
        analysisProfile: {
          selectedSourceIds: ['market', 'custom'],
          sequencePreference: ['market', 'fundamental', 'prediction'],
        },
        state: 'completed',
      }),
    ]);

    await executeAutomationJob(job);

    const completedCall = mocks.writeAutomationLifecycleToManagerConversation.mock.calls.find(
      (call) => call[0].phase === 'completed',
    )?.[0];

    expect(Array.isArray(completedCall?.memoryCandidates)).toBe(true);
    expect(completedCall.memoryCandidates.map((candidate: { keyText: string }) => candidate.keyText)).toEqual([
      'analysis-factors',
      'analysis-sequence',
      'automation-league-focus-habit',
    ]);
  });
});
