import { describe, expect, it } from 'vitest';
import type {
  AutomationDraft,
  AutomationJob,
  AutomationRun,
} from '@/src/services/automation/types';
import type { ManagerSessionProjection, ManagerRunRecord } from '@/src/services/manager-gateway/types';
import { buildManagerWorkspaceProjection } from '@/src/services/manager-workspace/projection';
import type { ManagerWorkspaceMemoryCandidate } from '@/src/services/manager-workspace/types';

function createDraft(overrides: Partial<AutomationDraft> = {}): AutomationDraft {
  return {
    id: 'draft_1',
    title: 'Analyze Arsenal vs Manchester City',
    sourceText: 'Analyze Arsenal vs Manchester City',
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    status: 'ready',
    intentType: 'one_time',
    activationMode: 'run_now',
    schedule: {
      type: 'one_time',
      runAt: '2026-03-13T12:00:00.000Z',
      timezone: 'Asia/Shanghai',
    },
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'match_1',
      subjectLabel: 'Arsenal vs Manchester City',
    },
    executionPolicy: {
      targetExpansion: 'single',
      recoveryWindowMinutes: 30,
      maxRetries: 1,
    },
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    analysisProfile: undefined,
    clarificationState: {
      roundsUsed: 0,
    },
    rejectionReason: undefined,
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

function createJob(overrides: Partial<AutomationJob> = {}): AutomationJob {
  return {
    id: 'job_1',
    title: 'Analyze Arsenal vs Manchester City',
    sourceDraftId: 'draft_1',
    sourceRuleId: undefined,
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    triggerType: 'one_time',
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'match_1',
      subjectLabel: 'Arsenal vs Manchester City',
    },
    targetSnapshot: undefined,
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    analysisProfile: undefined,
    scheduledFor: '2026-03-13T12:00:00.000Z',
    state: 'pending',
    retryCount: 0,
    maxRetries: 1,
    retryAfter: null,
    recoveryWindowEndsAt: null,
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

function createRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 'run_1',
    jobId: 'job_1',
    title: 'Analyze Arsenal vs Manchester City',
    state: 'completed',
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    startedAt: 100,
    endedAt: 300,
    provider: 'openai',
    model: 'gpt-5',
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    tokenSource: 'provider',
    resultHistoryId: 'football::match_1',
    errorCode: undefined,
    errorMessage: undefined,
    createdAt: 100,
    updatedAt: 300,
    ...overrides,
  };
}

function createManagerRun(overrides: Partial<ManagerRunRecord> = {}): ManagerRunRecord {
  return {
    id: 'manager_run_1',
    sessionId: 'session_main',
    inputMessageId: 'message_1',
    status: 'running',
    triggerType: 'user',
    plannerMode: 'workflow',
    intentType: 'analysis',
    toolPath: 'workflow:football_task_intake',
    errorCode: null,
    errorMessage: null,
    stateData: null,
    startedAt: 100,
    finishedAt: null,
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

function createManagerProjection(
  overrides: Partial<ManagerSessionProjection> = {},
): ManagerSessionProjection {
  return {
    session: {
      id: 'session_main',
      sessionKey: 'manager:main',
      title: 'Manager',
      status: 'active',
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
      activeWorkflowType: null,
      activeWorkflowStateData: null,
      latestSummaryId: null,
      latestMessageAt: 300,
      createdAt: 100,
      updatedAt: 300,
    },
    runtimeDomainId: 'football',
    runtimeDomainVersion: '1.0.0',
    feed: [],
    activeRun: null,
    latestRun: createManagerRun({
      status: 'completed',
      finishedAt: 300,
      updatedAt: 300,
    }),
    activeWorkflow: null,
    ...overrides,
  };
}

function createMemoryCandidate(
  overrides: Partial<ManagerWorkspaceMemoryCandidate> = {},
): ManagerWorkspaceMemoryCandidate {
  return {
    id: 'memory_candidate_1',
    title: 'Prefer market analysis first',
    status: 'pending',
    memoryType: 'preference',
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

describe('buildManagerWorkspaceProjection', () => {
  it('merges manager, automation, and memory candidate state into one workspace projection', () => {
    const projection = buildManagerWorkspaceProjection({
      managerProjection: createManagerProjection(),
      drafts: [
        createDraft({
          id: 'draft_ready',
          status: 'ready',
          updatedAt: 200,
        }),
        createDraft({
          id: 'draft_clarify',
          status: 'needs_clarification',
          updatedAt: 220,
        }),
      ],
      jobs: [
        createJob({
          id: 'job_pending',
          state: 'pending',
          updatedAt: 250,
        }),
        createJob({
          id: 'job_running',
          state: 'running',
          updatedAt: 260,
        }),
      ],
      runs: [
        createRun({
          id: 'run_completed',
          jobId: 'job_done',
          state: 'completed',
          endedAt: 400,
          updatedAt: 400,
        }),
        createRun({
          id: 'run_running',
          jobId: 'job_running',
          state: 'running',
          endedAt: undefined,
          updatedAt: 350,
        }),
        createRun({
          id: 'run_failed',
          jobId: 'job_failed',
          state: 'failed',
          endedAt: 320,
          updatedAt: 320,
          errorMessage: 'Provider timeout',
        }),
      ],
      memoryCandidates: [
        createMemoryCandidate({
          id: 'memory_pending_1',
          status: 'pending',
        }),
        createMemoryCandidate({
          id: 'memory_enabled_1',
          status: 'enabled',
        }),
        createMemoryCandidate({
          id: 'memory_pending_2',
          status: 'pending',
        }),
      ],
    });

    expect(projection.taskState.pendingApprovals).toHaveLength(1);
    expect(projection.taskState.pendingClarifications).toHaveLength(1);
    expect(projection.taskState.pendingJobs).toHaveLength(1);
    expect(projection.taskState.runningJobs).toHaveLength(1);
    expect(projection.taskState.activeRuns).toHaveLength(1);
    expect(projection.taskState.failedRuns).toHaveLength(1);
    expect(projection.resultState.latestResults[0]).toMatchObject({
      runId: 'run_completed',
      status: 'completed',
    });
    expect(projection.resultState.latestResults[1]).toMatchObject({
      runId: 'run_failed',
      status: 'failed',
    });
    expect(projection.memoryState.pendingCount).toBe(2);
  });
});
