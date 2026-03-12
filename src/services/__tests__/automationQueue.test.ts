import { describe, expect, it } from 'vitest';
import { runAutomationQueueCycle } from '@/src/services/automation/queue';
import type {
  AutomationJob,
  AutomationRun,
} from '@/src/services/automation/types';

function createEligibleJob(id: string): AutomationJob {
  return {
    id,
    title: id,
    sourceDraftId: undefined,
    sourceRuleId: undefined,
    domainId: 'football',
    domainPackVersion: undefined,
    templateId: undefined,
    triggerType: 'one_time',
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: id,
      subjectLabel: id,
    },
    targetSnapshot: undefined,
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: false,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    scheduledFor: new Date(2026, 2, 11, 10, 0, 0, 0).toISOString(),
    state: 'eligible',
    retryCount: 0,
    maxRetries: 2,
    retryAfter: null,
    recoveryWindowEndsAt: new Date(2026, 2, 11, 10, 30, 0, 0).toISOString(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createRun(jobId: string, state: AutomationRun['state']): AutomationRun {
  return {
    id: `run-${jobId}`,
    jobId,
    title: jobId,
    state,
    domainId: 'football',
    startedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('runAutomationQueueCycle', () => {
  it('respects the global max parallel jobs budget', async () => {
    const jobs = [createEligibleJob('job-1'), createEligibleJob('job-2'), createEligibleJob('job-3')];
    const deferreds = jobs.map(() =>
      createDeferred<{
        status: 'completed';
        job: AutomationJob;
        run: AutomationRun;
        historyIds: string[];
        snapshots: [];
      }>(),
    );
    let active = 0;
    let maxActive = 0;
    let started = 0;

    const cyclePromise = runAutomationQueueCycle({
      jobs,
      budgetInput: {
        hostType: 'desktop_shell',
        preferredMaxParallelJobs: 2,
      },
      resolveProviderBudget: (_job, budget) => ({
        provider: 'gemini',
        model: 'gemini-3-flash-preview',
        key: 'shared',
        maxParallelJobs: budget.maxParallelJobs,
      }),
      executor: (job) => {
        const deferred = deferreds[started];
        started += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        return deferred.promise.then((result) => {
          active -= 1;
          return result;
        });
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toBe(2);
    expect(maxActive).toBe(2);

    deferreds[0].resolve({
      status: 'completed',
      job: jobs[0],
      run: createRun(jobs[0].id, 'completed'),
      historyIds: [],
      snapshots: [],
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toBe(3);

    deferreds[1].resolve({
      status: 'completed',
      job: jobs[1],
      run: createRun(jobs[1].id, 'completed'),
      historyIds: [],
      snapshots: [],
    });
    deferreds[2].resolve({
      status: 'completed',
      job: jobs[2],
      run: createRun(jobs[2].id, 'completed'),
      historyIds: [],
      snapshots: [],
    });

    const result = await cyclePromise;
    expect(result.executedJobIds).toHaveLength(3);
    expect(maxActive).toBe(2);
  });

  it('respects provider-level subcaps even when host budget is higher', async () => {
    const jobs = [createEligibleJob('job-a'), createEligibleJob('job-b')];
    const deferreds = jobs.map(() =>
      createDeferred<{
        status: 'completed';
        job: AutomationJob;
        run: AutomationRun;
        historyIds: string[];
        snapshots: [];
      }>(),
    );
    let active = 0;
    let maxActive = 0;
    let started = 0;

    const cyclePromise = runAutomationQueueCycle({
      jobs,
      budgetInput: {
        hostType: 'desktop_shell',
        preferredMaxParallelJobs: 3,
      },
      resolveProviderBudget: () => ({
        provider: 'gemini',
        model: 'gemini-3-flash-preview',
        key: 'shared',
        maxParallelJobs: 1,
      }),
      executor: (job) => {
        const deferred = deferreds[started];
        started += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        return deferred.promise.then((result) => {
          active -= 1;
          return result;
        });
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toBe(1);
    expect(maxActive).toBe(1);

    deferreds[0].resolve({
      status: 'completed',
      job: jobs[0],
      run: createRun(jobs[0].id, 'completed'),
      historyIds: [],
      snapshots: [],
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toBe(2);

    deferreds[1].resolve({
      status: 'completed',
      job: jobs[1],
      run: createRun(jobs[1].id, 'completed'),
      historyIds: [],
      snapshots: [],
    });

    await cyclePromise;
    expect(maxActive).toBe(1);
  });
});
