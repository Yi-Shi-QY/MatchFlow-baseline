import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAutomationHeartbeat } from '@/src/services/automation/heartbeat';
import type {
  AutomationJob,
  AutomationRun,
} from '@/src/services/automation/types';

const mocks = vi.hoisted(() => ({
  listAutomationJobs: vi.fn(),
  saveAutomationJob: vi.fn(),
  listAutomationRuns: vi.fn(),
  saveAutomationRun: vi.fn(),
  runAutomationSchedulerCycle: vi.fn(),
  runAutomationQueueCycle: vi.fn(),
}));

vi.mock('@/src/services/automation/jobStore', () => ({
  listAutomationJobs: mocks.listAutomationJobs,
  saveAutomationJob: mocks.saveAutomationJob,
}));

vi.mock('@/src/services/automation/runStore', () => ({
  listAutomationRuns: mocks.listAutomationRuns,
  saveAutomationRun: mocks.saveAutomationRun,
}));

vi.mock('@/src/services/automation/scheduler', () => ({
  runAutomationSchedulerCycle: mocks.runAutomationSchedulerCycle,
}));

vi.mock('@/src/services/automation/queue', () => ({
  runAutomationQueueCycle: mocks.runAutomationQueueCycle,
}));

function createJob(overrides: Partial<AutomationJob>): AutomationJob {
  const now = Date.now();
  return {
    id: 'job',
    title: 'job',
    sourceDraftId: undefined,
    sourceRuleId: undefined,
    domainId: 'football',
    domainPackVersion: undefined,
    templateId: undefined,
    triggerType: 'one_time',
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'm1',
      subjectLabel: 'm1',
    },
    targetSnapshot: undefined,
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: false,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    scheduledFor: new Date(2026, 2, 11, 10, 0, 0, 0).toISOString(),
    state: 'pending',
    retryCount: 0,
    maxRetries: 2,
    retryAfter: null,
    recoveryWindowEndsAt: new Date(2026, 2, 11, 10, 30, 0, 0).toISOString(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createRun(overrides: Partial<AutomationRun>): AutomationRun {
  const now = Date.now();
  return {
    id: 'run-1',
    jobId: 'job-3',
    title: 'run',
    state: 'running',
    domainId: 'football',
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('runAutomationHeartbeat', () => {
  beforeEach(() => {
    mocks.listAutomationJobs.mockReset();
    mocks.saveAutomationJob.mockReset();
    mocks.listAutomationRuns.mockReset();
    mocks.saveAutomationRun.mockReset();
    mocks.runAutomationSchedulerCycle.mockReset();
    mocks.runAutomationQueueCycle.mockReset();
  });

  it('marks due and retryable jobs eligible, converts stale running jobs, and triggers the queue', async () => {
    const now = new Date(2026, 2, 11, 10, 20, 0, 0);
    mocks.runAutomationSchedulerCycle.mockResolvedValue({
      createdJobs: [],
      updatedRules: [],
      skippedDuplicateCount: 0,
      skippedPastOccurrenceCount: 0,
      scannedRuleCount: 0,
      existingJobCount: 3,
    });
    mocks.listAutomationJobs.mockResolvedValue([
      createJob({
        id: 'job-1',
        state: 'pending',
        scheduledFor: new Date(2026, 2, 11, 10, 0, 0, 0).toISOString(),
        recoveryWindowEndsAt: new Date(2026, 2, 11, 10, 30, 0, 0).toISOString(),
      }),
      createJob({
        id: 'job-2',
        state: 'failed_retryable',
        retryAfter: new Date(2026, 2, 11, 10, 15, 0, 0).toISOString(),
      }),
      createJob({
        id: 'job-3',
        state: 'running',
        retryCount: 0,
      }),
    ]);
    mocks.listAutomationRuns.mockResolvedValue([
      createRun({
        id: 'run-job-3',
        jobId: 'job-3',
        startedAt: new Date(2026, 2, 11, 8, 0, 0, 0).getTime(),
      }),
    ]);
    mocks.runAutomationQueueCycle.mockResolvedValue({
      executedJobIds: ['job-1', 'job-2'],
      results: [],
      snapshot: {
        status: 'idle',
        hostType: 'browser_web',
        maxParallelJobs: 1,
        queuedJobIds: [],
        runningJobIds: [],
        completedJobIds: ['job-1', 'job-2'],
        failedJobIds: [],
        providerBudgets: {},
        updatedAt: now.getTime(),
      },
    });

    const result = await runAutomationHeartbeat({
      now,
      runQueue: true,
      staleRunTimeoutMs: 30 * 60 * 1000,
    });

    expect(result.eligibleJobIds).toEqual(['job-1', 'job-2']);
    expect(result.counts.eligibleDue).toBe(1);
    expect(result.counts.eligibleRetry).toBe(1);
    expect(result.counts.staleRunning).toBe(1);

    expect(mocks.saveAutomationJob).toHaveBeenCalledTimes(3);
    expect(mocks.saveAutomationRun).toHaveBeenCalledTimes(1);
    expect(mocks.runAutomationQueueCycle).toHaveBeenCalledTimes(1);

    const queuedJobs = mocks.runAutomationQueueCycle.mock.calls[0][0].jobs as AutomationJob[];
    expect(queuedJobs.map((job) => job.id)).toEqual(['job-1', 'job-2']);

    const staleRunSave = mocks.saveAutomationRun.mock.calls[0][0] as AutomationRun;
    expect(staleRunSave.state).toBe('failed');
  });
});
