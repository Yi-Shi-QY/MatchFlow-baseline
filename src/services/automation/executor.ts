import type { ActiveAnalysis } from '@/src/contexts/analysis/types';
import {
  combineTokenSource,
  executeAnalysisRun,
} from './executionRuntime';
import { assembleAutomationJob } from './jobAssembler';
import type { AutomationJobExecutionContext } from './jobExecutionContext';
import { listAutomationJobs, saveAutomationJob } from './jobStore';
import { scheduleNativeAutomationSync } from './nativeScheduler';
import {
  notifyAutomationRunCompleted,
  notifyAutomationRunFailed,
  notifyAutomationRunStarted,
} from './notifications';
import { writeAutomationLifecycleToManagerConversation } from '@/src/services/manager-workspace/automationWritebackBridge';
import { detectMemoryCandidatesFromAutomationResult } from '@/src/services/memoryCandidateDetectors';
import { saveAutomationRun } from './runStore';
import type { AutomationJob, AutomationRun } from './types';
import { createAutomationId } from './utils';

export interface AutomationJobExecutionResult {
  status: AutomationRun['state'];
  job: AutomationJob;
  run: AutomationRun;
  historyIds: string[];
  snapshots: ActiveAnalysis[];
}

function linkAbortSignal(source: AbortSignal | undefined, target: AbortController): () => void {
  if (!source) {
    return () => {};
  }

  const abort = () => {
    if (!target.signal.aborted) {
      target.abort();
    }
  };

  if (source.aborted) {
    abort();
    return () => {};
  }

  source.addEventListener('abort', abort, { once: true });
  return () => {
    source.removeEventListener('abort', abort);
  };
}

function buildRetryAfter(): string {
  return new Date(Date.now() + 5 * 60_000).toISOString();
}

function pickLatestSnapshotMetrics(snapshots: ActiveAnalysis[]) {
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    if (snapshots[index].runMetrics) {
      return snapshots[index].runMetrics;
    }
  }
  return null;
}

function buildRunMetricPatch(snapshots: ActiveAnalysis[]): Pick<
  AutomationRun,
  'provider' | 'model' | 'inputTokens' | 'outputTokens' | 'totalTokens' | 'tokenSource'
> {
  const latestMetrics = pickLatestSnapshotMetrics(snapshots);
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let tokenSource: AutomationRun['tokenSource'] = 'none';

  snapshots.forEach((snapshot) => {
    const metrics = snapshot.runMetrics;
    if (!metrics) {
      return;
    }
    inputTokens += metrics.inputTokens;
    outputTokens += metrics.outputTokens;
    totalTokens += metrics.totalTokens;
    tokenSource = combineTokenSource(
      tokenSource as 'none' | 'provider' | 'estimated' | 'mixed',
      metrics.tokenSource,
    );
  });

  return {
    provider: latestMetrics?.currentProvider || undefined,
    model: latestMetrics?.currentModel || undefined,
    inputTokens: inputTokens > 0 ? inputTokens : undefined,
    outputTokens: outputTokens > 0 ? outputTokens : undefined,
    totalTokens: totalTokens > 0 ? totalTokens : undefined,
    tokenSource: tokenSource === 'none' ? undefined : tokenSource,
  };
}

async function emitStateChange(
  ctx: AutomationJobExecutionContext,
  phase: 'started' | 'completed' | 'failed' | 'cancelled',
  job: AutomationJob,
  run: AutomationRun,
): Promise<void> {
  if (phase === 'started' && job.notificationPolicy.notifyOnStart) {
    await notifyAutomationRunStarted(job, run);
  }
  if (phase === 'completed' && job.notificationPolicy.notifyOnComplete) {
    await notifyAutomationRunCompleted(job, run);
  }
  if (phase === 'failed' && job.notificationPolicy.notifyOnFailure) {
    await notifyAutomationRunFailed(job, run);
  }
  const memoryCandidates =
    phase === 'completed'
      ? detectMemoryCandidatesFromAutomationResult({
          job,
          run,
          historicalJobs: await listAutomationJobs(),
        })
      : [];
  try {
    await writeAutomationLifecycleToManagerConversation({
      phase,
      job,
      run,
      memoryCandidates,
    });
  } catch (error) {
    console.warn('Failed to write automation lifecycle into manager conversation.', error);
  }
  await ctx.onStateChange?.({
    phase,
    job,
    run,
  });
}

export async function executeAutomationJob(
  job: AutomationJob,
  ctx: AutomationJobExecutionContext = {},
): Promise<AutomationJobExecutionResult> {
  const startedAt = Date.now();
  const abortController = new AbortController();
  const detachAbortLink = linkAbortSignal(ctx.signal, abortController);
  const includeAnimations = ctx.includeAnimations ?? false;
  const resumeMode = ctx.resumeMode ?? 'enabled';
  const snapshots: ActiveAnalysis[] = [];
  const historyIds: string[] = [];

  let persistedJob: AutomationJob = {
    ...job,
    state: 'running',
    retryAfter: null,
    updatedAt: startedAt,
  };
  let persistedRun: AutomationRun = {
    id: createAutomationId('automation_run'),
    jobId: job.id,
    title: job.title,
    state: 'running',
    domainId: job.domainId,
    domainPackVersion: job.domainPackVersion,
    templateId: job.templateId,
    startedAt,
    createdAt: startedAt,
    updatedAt: startedAt,
  };

  await saveAutomationJob(persistedJob);
  await saveAutomationRun(persistedRun);
  scheduleNativeAutomationSync('automation_job_started');
  await emitStateChange(ctx, 'started', persistedJob, persistedRun);

  try {
    const assembled = await assembleAutomationJob(persistedJob);
    persistedJob = {
      ...persistedJob,
      targetSnapshot: assembled.targetSnapshot,
      updatedAt: Date.now(),
    };
    await saveAutomationJob(persistedJob);

    for (const target of assembled.targets) {
      const result = await executeAnalysisRun({
        match: target.match,
        subjectSnapshot: target.match,
        dataToAnalyze: target.dataToAnalyze,
        includeAnimations,
        isResume: resumeMode === 'enabled' && persistedJob.retryCount > 0,
        abortController,
        runtimeSource: 'bridge',
        resumeMode,
        subjectRef: {
          domainId: target.domainId,
          subjectId: target.subjectId,
          subjectType: target.subjectType,
        },
      });

      snapshots.push(result.snapshot);
      if (result.historyId) {
        historyIds.push(result.historyId);
      }

      if (result.status === 'cancelled') {
        persistedJob = {
          ...persistedJob,
          state: 'cancelled',
          updatedAt: Date.now(),
        };
        persistedRun = {
          ...persistedRun,
          ...buildRunMetricPatch(snapshots),
          state: 'cancelled',
          endedAt: Date.now(),
          updatedAt: Date.now(),
          resultHistoryId: historyIds[historyIds.length - 1],
        };
        await saveAutomationJob(persistedJob);
        await saveAutomationRun(persistedRun);
        scheduleNativeAutomationSync('automation_job_cancelled');
        await emitStateChange(ctx, 'cancelled', persistedJob, persistedRun);
        return {
          status: 'cancelled',
          job: persistedJob,
          run: persistedRun,
          historyIds,
          snapshots,
        };
      }

      if (result.status === 'failed') {
        const retryable = persistedJob.retryCount < persistedJob.maxRetries;
        persistedJob = {
          ...persistedJob,
          state: retryable ? 'failed_retryable' : 'failed_terminal',
          retryCount: persistedJob.retryCount + 1,
          retryAfter: retryable ? buildRetryAfter() : null,
          updatedAt: Date.now(),
        };
        persistedRun = {
          ...persistedRun,
          ...buildRunMetricPatch(snapshots),
          state: 'failed',
          endedAt: Date.now(),
          updatedAt: Date.now(),
          errorMessage: result.errorMessage || 'Automation analysis failed.',
          resultHistoryId: historyIds[historyIds.length - 1],
        };
        await saveAutomationJob(persistedJob);
        await saveAutomationRun(persistedRun);
        scheduleNativeAutomationSync('automation_job_failed');
        await emitStateChange(ctx, 'failed', persistedJob, persistedRun);
        return {
          status: 'failed',
          job: persistedJob,
          run: persistedRun,
          historyIds,
          snapshots,
        };
      }
    }

    persistedJob = {
      ...persistedJob,
      state: 'completed',
      updatedAt: Date.now(),
    };
    persistedRun = {
      ...persistedRun,
      ...buildRunMetricPatch(snapshots),
      state: 'completed',
      endedAt: Date.now(),
      updatedAt: Date.now(),
      resultHistoryId: historyIds[historyIds.length - 1],
    };
    await saveAutomationJob(persistedJob);
    await saveAutomationRun(persistedRun);
    scheduleNativeAutomationSync('automation_job_completed');
    await emitStateChange(ctx, 'completed', persistedJob, persistedRun);

    return {
      status: 'completed',
      job: persistedJob,
      run: persistedRun,
      historyIds,
      snapshots,
    };
  } catch (error) {
    console.error('Automation job execution failed.', error);
    const retryable = persistedJob.retryCount < persistedJob.maxRetries;
    persistedJob = {
      ...persistedJob,
      state: retryable ? 'failed_retryable' : 'failed_terminal',
      retryCount: persistedJob.retryCount + 1,
      retryAfter: retryable ? buildRetryAfter() : null,
      updatedAt: Date.now(),
    };
    persistedRun = {
      ...persistedRun,
      ...buildRunMetricPatch(snapshots),
      state: 'failed',
      endedAt: Date.now(),
      updatedAt: Date.now(),
      errorMessage:
        error instanceof Error && error.message
          ? error.message
          : 'Automation job execution failed.',
      resultHistoryId: historyIds[historyIds.length - 1],
    };
    await saveAutomationJob(persistedJob);
    await saveAutomationRun(persistedRun);
    scheduleNativeAutomationSync('automation_job_failed');
    await emitStateChange(ctx, 'failed', persistedJob, persistedRun);

    return {
      status: 'failed',
      job: persistedJob,
      run: persistedRun,
      historyIds,
      snapshots,
    };
  } finally {
    detachAbortLink();
  }
}
