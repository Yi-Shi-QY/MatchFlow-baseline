import { DEFAULT_AUTOMATION_STALE_RUN_TIMEOUT_MS } from './constants';
import { type AutomationConcurrencyBudgetInput } from './concurrencyBudget';
import {
  listAutomationJobs,
  saveAutomationJob,
} from './jobStore';
import { runAutomationQueueCycle, type AutomationQueueCycleResult } from './queue';
import {
  reconcileAutomationJobsForHeartbeat,
  type AutomationRecoveryResult,
} from './recovery';
import { listAutomationRuns, saveAutomationRun } from './runStore';
import { scheduleNativeAutomationSync } from './nativeScheduler';
import { runAutomationSchedulerCycle, type AutomationSchedulerCycleResult } from './scheduler';
import type { AutomationJob, AutomationRun } from './types';

export interface AutomationHeartbeatOptions {
  now?: Date;
  runQueue?: boolean;
  persist?: boolean;
  staleRunTimeoutMs?: number;
  budgetInput?: AutomationConcurrencyBudgetInput;
  jobs?: AutomationJob[];
  runs?: AutomationRun[];
  schedulerResult?: AutomationSchedulerCycleResult;
}

export interface AutomationHeartbeatResult {
  schedulerResult: AutomationSchedulerCycleResult;
  recoveryResults: AutomationRecoveryResult[];
  queueResult: AutomationQueueCycleResult | null;
  eligibleJobIds: string[];
  counts: {
    eligibleDue: number;
    eligibleRetry: number;
    expired: number;
    failedTerminal: number;
    staleRunning: number;
  };
}

function countRecoveryActions(recoveryResults: AutomationRecoveryResult[]) {
  return recoveryResults.reduce(
    (acc, result) => {
      if (result.action === 'eligible_due') acc.eligibleDue += 1;
      if (result.action === 'eligible_retry') acc.eligibleRetry += 1;
      if (result.action === 'expired') acc.expired += 1;
      if (result.action === 'failed_terminal') acc.failedTerminal += 1;
      if (result.action === 'stale_running') acc.staleRunning += 1;
      return acc;
    },
    {
      eligibleDue: 0,
      eligibleRetry: 0,
      expired: 0,
      failedTerminal: 0,
      staleRunning: 0,
    },
  );
}

async function persistRecoveryResults(
  recoveryResults: AutomationRecoveryResult[],
  now: Date,
): Promise<void> {
  for (const result of recoveryResults) {
    if (result.action === 'unchanged') {
      continue;
    }

    await saveAutomationJob(result.job);

    if (
      result.latestRun &&
      result.latestRun.state === 'running' &&
      (result.action === 'stale_running' || result.action === 'failed_terminal')
    ) {
      await saveAutomationRun({
        ...result.latestRun,
        state: 'failed',
        endedAt: now.getTime(),
        updatedAt: now.getTime(),
        errorMessage:
          result.latestRun.errorMessage || 'Heartbeat marked stale running automation as failed.',
      });
    }
  }
}

export async function runAutomationHeartbeat(
  options: AutomationHeartbeatOptions = {},
): Promise<AutomationHeartbeatResult> {
  const now = options.now || new Date();
  const persist = options.persist !== false;
  const schedulerResult =
    options.schedulerResult ||
    (await runAutomationSchedulerCycle({
      now,
      persist,
    }));

  const jobs =
    options.jobs ||
    (persist
      ? await listAutomationJobs()
      : [...(await listAutomationJobs()), ...schedulerResult.createdJobs]);
  const runs = options.runs || (await listAutomationRuns());
  const recoveryResults = reconcileAutomationJobsForHeartbeat(jobs, runs, {
    now,
    staleRunTimeoutMs:
      typeof options.staleRunTimeoutMs === 'number'
        ? options.staleRunTimeoutMs
        : DEFAULT_AUTOMATION_STALE_RUN_TIMEOUT_MS,
  });

  if (persist) {
    await persistRecoveryResults(recoveryResults, now);
    scheduleNativeAutomationSync('automation_heartbeat_recovery');
  }

  const eligibleJobs = recoveryResults
    .map((result) => result.job)
    .filter((job) => job.state === 'eligible');

  const queueResult =
    options.runQueue && eligibleJobs.length > 0
      ? await runAutomationQueueCycle({
          jobs: eligibleJobs,
          budgetInput: options.budgetInput,
        })
      : null;

  return {
    schedulerResult,
    recoveryResults,
    queueResult,
    eligibleJobIds: eligibleJobs.map((job) => job.id),
    counts: countRecoveryActions(recoveryResults),
  };
}
