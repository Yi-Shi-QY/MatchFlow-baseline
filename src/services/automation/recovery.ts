import { DEFAULT_AUTOMATION_RETRY_BACKOFF_MS } from './constants';
import { parseAutomationTimestamp } from './time';
import type { AutomationJob, AutomationRun } from './types';

export type AutomationRecoveryAction =
  | 'eligible_due'
  | 'eligible_retry'
  | 'expired'
  | 'failed_terminal'
  | 'stale_running'
  | 'unchanged';

export interface AutomationRecoveryOptions {
  now?: Date;
  staleRunTimeoutMs?: number;
}

export interface AutomationRecoveryResult {
  job: AutomationJob;
  latestRun?: AutomationRun;
  action: AutomationRecoveryAction;
}

function isPast(timestamp: string | null, nowMs: number): boolean {
  const parsed = parseAutomationTimestamp(timestamp);
  return parsed !== null && parsed <= nowMs;
}

function isBeforeOrAt(timestamp: string | null, nowMs: number): boolean {
  const parsed = parseAutomationTimestamp(timestamp);
  return parsed !== null && parsed <= nowMs;
}

function hasRecoveryWindowClosed(job: AutomationJob, nowMs: number): boolean {
  const recoveryWindowMs = parseAutomationTimestamp(job.recoveryWindowEndsAt);
  return recoveryWindowMs !== null && recoveryWindowMs < nowMs;
}

function latestRunForJob(runs: AutomationRun[], jobId: string): AutomationRun | undefined {
  const matchingRuns = runs
    .filter((run) => run.jobId === jobId)
    .sort((left, right) => right.createdAt - left.createdAt);
  return matchingRuns[0];
}

export function reconcileAutomationJobForHeartbeat(
  job: AutomationJob,
  runs: AutomationRun[],
  options: AutomationRecoveryOptions = {},
): AutomationRecoveryResult {
  const now = options.now || new Date();
  const nowMs = now.getTime();
  const latestRun = latestRunForJob(runs, job.id);
  const staleRunTimeoutMs =
    typeof options.staleRunTimeoutMs === 'number' && Number.isFinite(options.staleRunTimeoutMs)
      ? Math.max(1, Math.floor(options.staleRunTimeoutMs))
      : 0;

  if (job.state === 'completed' || job.state === 'cancelled' || job.state === 'failed_terminal') {
    return {
      job,
      latestRun,
      action: 'unchanged',
    };
  }

  if (job.state === 'running') {
    if (!latestRun || latestRun.state !== 'running') {
      const retryable = job.retryCount < job.maxRetries && !hasRecoveryWindowClosed(job, nowMs);
      return {
        job: {
          ...job,
          state: retryable ? 'failed_retryable' : 'failed_terminal',
          retryAfter: retryable ? new Date(nowMs + DEFAULT_AUTOMATION_RETRY_BACKOFF_MS).toISOString() : null,
          updatedAt: nowMs,
        },
        latestRun,
        action: retryable ? 'stale_running' : 'failed_terminal',
      };
    }

    if (staleRunTimeoutMs > 0 && latestRun.startedAt + staleRunTimeoutMs <= nowMs) {
      const retryable = job.retryCount < job.maxRetries && !hasRecoveryWindowClosed(job, nowMs);
      return {
        job: {
          ...job,
          state: retryable ? 'failed_retryable' : 'failed_terminal',
          retryAfter: retryable ? new Date(nowMs + DEFAULT_AUTOMATION_RETRY_BACKOFF_MS).toISOString() : null,
          updatedAt: nowMs,
        },
        latestRun,
        action: retryable ? 'stale_running' : 'failed_terminal',
      };
    }

    return {
      job,
      latestRun,
      action: 'unchanged',
    };
  }

  if (job.state === 'failed_retryable') {
    if (hasRecoveryWindowClosed(job, nowMs)) {
      return {
        job: {
          ...job,
          state: 'failed_terminal',
          retryAfter: null,
          updatedAt: nowMs,
        },
        latestRun,
        action: 'failed_terminal',
      };
    }

    if (!job.retryAfter || isBeforeOrAt(job.retryAfter, nowMs)) {
      return {
        job: {
          ...job,
          state: 'eligible',
          retryAfter: null,
          updatedAt: nowMs,
        },
        latestRun,
        action: 'eligible_retry',
      };
    }

    return {
      job,
      latestRun,
      action: 'unchanged',
    };
  }

  if (job.state === 'pending') {
    const scheduledForMs = parseAutomationTimestamp(job.scheduledFor);
    if (scheduledForMs === null) {
      return {
        job: {
          ...job,
          state: 'expired',
          updatedAt: nowMs,
        },
        latestRun,
        action: 'expired',
      };
    }

    if (scheduledForMs > nowMs) {
      return {
        job,
        latestRun,
        action: 'unchanged',
      };
    }

    if (hasRecoveryWindowClosed(job, nowMs)) {
      return {
        job: {
          ...job,
          state: 'expired',
          updatedAt: nowMs,
        },
        latestRun,
        action: 'expired',
      };
    }

    return {
      job: {
        ...job,
        state: 'eligible',
        updatedAt: nowMs,
      },
      latestRun,
      action: 'eligible_due',
    };
  }

  return {
    job,
    latestRun,
    action: 'unchanged',
  };
}

export function reconcileAutomationJobsForHeartbeat(
  jobs: AutomationJob[],
  runs: AutomationRun[],
  options: AutomationRecoveryOptions = {},
): AutomationRecoveryResult[] {
  return jobs.map((job) => reconcileAutomationJobForHeartbeat(job, runs, options));
}
