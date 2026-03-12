import type { AutomationJobExecutionContext } from './jobExecutionContext';
import {
  resolveAutomationConcurrencyBudget,
  type AutomationConcurrencyBudget,
  type AutomationConcurrencyBudgetInput,
} from './concurrencyBudget';
import {
  resolveAutomationProviderBudgetForJob,
  type AutomationProviderBudget,
} from './providerBudget';
import { executeAutomationJob, type AutomationJobExecutionResult } from './executor';
import type { AutomationJob } from './types';

export interface AutomationQueueProviderSnapshot {
  limit: number;
  running: number;
  queued: number;
}

export interface AutomationQueueSnapshot {
  status: 'idle' | 'running';
  hostType: AutomationConcurrencyBudget['hostType'];
  maxParallelJobs: number;
  queuedJobIds: string[];
  runningJobIds: string[];
  completedJobIds: string[];
  failedJobIds: string[];
  providerBudgets: Record<string, AutomationQueueProviderSnapshot>;
  updatedAt: number;
}

export interface AutomationQueueCycleOptions {
  jobs: AutomationJob[];
  budgetInput?: AutomationConcurrencyBudgetInput;
  executor?: (
    job: AutomationJob,
    ctx?: AutomationJobExecutionContext,
  ) => Promise<AutomationJobExecutionResult>;
  buildExecutionContext?: (job: AutomationJob) => AutomationJobExecutionContext;
  resolveProviderBudget?: (
    job: AutomationJob,
    budget: AutomationConcurrencyBudget,
  ) => AutomationProviderBudget;
}

export interface AutomationQueueCycleResult {
  executedJobIds: string[];
  results: AutomationJobExecutionResult[];
  snapshot: AutomationQueueSnapshot;
}

const queueListeners = new Set<(snapshot: AutomationQueueSnapshot) => void>();

let queueSnapshot: AutomationQueueSnapshot = {
  status: 'idle',
  hostType: 'browser_web',
  maxParallelJobs: 0,
  queuedJobIds: [],
  runningJobIds: [],
  completedJobIds: [],
  failedJobIds: [],
  providerBudgets: {},
  updatedAt: Date.now(),
};

let currentQueueCycle: Promise<AutomationQueueCycleResult> | null = null;

function publishQueueSnapshot(snapshot: AutomationQueueSnapshot) {
  queueSnapshot = snapshot;
  queueListeners.forEach((listener) => listener(queueSnapshot));
}

export function getAutomationQueueSnapshot(): AutomationQueueSnapshot {
  return queueSnapshot;
}

export function subscribeAutomationQueue(
  listener: (snapshot: AutomationQueueSnapshot) => void,
): () => void {
  queueListeners.add(listener);
  listener(queueSnapshot);
  return () => {
    queueListeners.delete(listener);
  };
}

function updateQueueSnapshot(input: Partial<AutomationQueueSnapshot>) {
  publishQueueSnapshot({
    ...queueSnapshot,
    ...input,
    updatedAt: Date.now(),
  });
}

function buildProviderSnapshot(
  queuedJobs: AutomationJob[],
  runningJobs: AutomationJob[],
  budget: AutomationConcurrencyBudget,
  resolveProviderBudget: NonNullable<AutomationQueueCycleOptions['resolveProviderBudget']>,
): Record<string, AutomationQueueProviderSnapshot> {
  const providerState = new Map<string, AutomationQueueProviderSnapshot>();

  const ensureEntry = (job: AutomationJob): AutomationQueueProviderSnapshot => {
    const providerBudget = resolveProviderBudget(job, budget);
    const existing = providerState.get(providerBudget.key);
    if (existing) {
      return existing;
    }
    const nextEntry: AutomationQueueProviderSnapshot = {
      limit: providerBudget.maxParallelJobs,
      running: 0,
      queued: 0,
    };
    providerState.set(providerBudget.key, nextEntry);
    return nextEntry;
  };

  queuedJobs.forEach((job) => {
    const entry = ensureEntry(job);
    entry.queued += 1;
  });

  runningJobs.forEach((job) => {
    const entry = ensureEntry(job);
    entry.running += 1;
  });

  return Object.fromEntries(providerState.entries());
}

function findNextRunnableJob(
  queuedJobs: AutomationJob[],
  runningJobs: AutomationJob[],
  budget: AutomationConcurrencyBudget,
  resolveProviderBudget: NonNullable<AutomationQueueCycleOptions['resolveProviderBudget']>,
): number {
  const runningCounts = new Map<string, number>();
  runningJobs.forEach((job) => {
    const providerBudget = resolveProviderBudget(job, budget);
    runningCounts.set(providerBudget.key, (runningCounts.get(providerBudget.key) || 0) + 1);
  });

  for (let index = 0; index < queuedJobs.length; index += 1) {
    const providerBudget = resolveProviderBudget(queuedJobs[index], budget);
    const runningCount = runningCounts.get(providerBudget.key) || 0;
    if (runningCount < providerBudget.maxParallelJobs) {
      return index;
    }
  }

  return -1;
}

function sortJobsForQueue(jobs: AutomationJob[]): AutomationJob[] {
  return [...jobs].sort((left, right) => {
    const leftAt = new Date(left.scheduledFor).getTime();
    const rightAt = new Date(right.scheduledFor).getTime();
    return leftAt - rightAt;
  });
}

async function runQueueCycleInternal(
  options: AutomationQueueCycleOptions,
): Promise<AutomationQueueCycleResult> {
  const budget = resolveAutomationConcurrencyBudget(options.budgetInput);
  const resolveProviderBudget =
    options.resolveProviderBudget || resolveAutomationProviderBudgetForJob;
  const executor = options.executor || executeAutomationJob;
  const buildExecutionContext = options.buildExecutionContext || (() => ({}));
  const queuedJobs = sortJobsForQueue(options.jobs.filter((job) => job.state === 'eligible'));
  const runningJobs: AutomationJob[] = [];
  const completedJobIds: string[] = [];
  const failedJobIds: string[] = [];
  const executedJobIds: string[] = [];
  const results: AutomationJobExecutionResult[] = [];

  publishQueueSnapshot({
    status: queuedJobs.length > 0 && budget.maxParallelJobs > 0 ? 'running' : 'idle',
    hostType: budget.hostType,
    maxParallelJobs: budget.maxParallelJobs,
    queuedJobIds: queuedJobs.map((job) => job.id),
    runningJobIds: [],
    completedJobIds: [],
    failedJobIds: [],
    providerBudgets: buildProviderSnapshot(queuedJobs, runningJobs, budget, resolveProviderBudget),
    updatedAt: Date.now(),
  });

  if (queuedJobs.length === 0 || budget.maxParallelJobs <= 0) {
    updateQueueSnapshot({ status: 'idle' });
    return {
      executedJobIds,
      results,
      snapshot: queueSnapshot,
    };
  }

  const launchJob = async (job: AutomationJob) => {
    runningJobs.push(job);
    updateQueueSnapshot({
      queuedJobIds: queuedJobs.map((entry) => entry.id),
      runningJobIds: runningJobs.map((entry) => entry.id),
      completedJobIds,
      failedJobIds,
      providerBudgets: buildProviderSnapshot(queuedJobs, runningJobs, budget, resolveProviderBudget),
    });

    try {
      executedJobIds.push(job.id);
      const result = await executor(job, buildExecutionContext(job));
      results.push(result);

      if (result.status === 'completed') {
        completedJobIds.push(job.id);
      } else {
        failedJobIds.push(job.id);
      }
    } catch (error) {
      console.error('Automation queue job crashed.', error);
      failedJobIds.push(job.id);
    } finally {
      const runningIndex = runningJobs.findIndex((entry) => entry.id === job.id);
      if (runningIndex >= 0) {
        runningJobs.splice(runningIndex, 1);
      }

      updateQueueSnapshot({
        queuedJobIds: queuedJobs.map((entry) => entry.id),
        runningJobIds: runningJobs.map((entry) => entry.id),
        completedJobIds,
        failedJobIds,
        providerBudgets: buildProviderSnapshot(queuedJobs, runningJobs, budget, resolveProviderBudget),
      });
    }
  };

  const worker = async () => {
    while (true) {
      const nextIndex = findNextRunnableJob(queuedJobs, runningJobs, budget, resolveProviderBudget);
      if (nextIndex < 0) {
        if (queuedJobs.length === 0) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
        continue;
      }

      const [job] = queuedJobs.splice(nextIndex, 1);
      if (!job) {
        return;
      }
      updateQueueSnapshot({
        queuedJobIds: queuedJobs.map((entry) => entry.id),
        providerBudgets: buildProviderSnapshot(queuedJobs, runningJobs, budget, resolveProviderBudget),
      });
      await launchJob(job);
    }
  };

  const workerCount = Math.min(budget.maxParallelJobs, queuedJobs.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  updateQueueSnapshot({
    status: 'idle',
    queuedJobIds: [],
    runningJobIds: [],
    completedJobIds,
    failedJobIds,
    providerBudgets: {},
  });

  return {
    executedJobIds,
    results,
    snapshot: queueSnapshot,
  };
}

export async function runAutomationQueueCycle(
  options: AutomationQueueCycleOptions,
): Promise<AutomationQueueCycleResult> {
  if (!currentQueueCycle) {
    currentQueueCycle = runQueueCycleInternal(options).finally(() => {
      currentQueueCycle = null;
    });
  }

  return currentQueueCycle;
}
