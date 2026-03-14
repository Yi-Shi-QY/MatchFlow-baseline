import {
  AUTOMATION_JOBS_STORAGE_KEY,
  DEFAULT_AUTOMATION_NOTIFICATION_POLICY,
  MAX_AUTOMATION_JOB_COUNT,
} from './constants';
import {
  normalizeBoolean,
  normalizeObject,
  normalizeString,
  normalizeTimestamp,
  readAutomationRecords,
  writeAutomationRecords,
} from './storageFallback';
import type {
  AutomationJob,
  AutomationJobQueryOptions,
  AutomationTargetSnapshot,
  AutomationTargetSnapshotItem,
} from './types';
import {
  normalizeAutomationAnalysisProfile,
  normalizeAutomationTargetSelector,
} from './recordNormalizers';
import { sortByScheduledForAsc } from './utils';

function normalizeTargetSnapshotItem(input: unknown): AutomationTargetSnapshotItem | null {
  const value = normalizeObject<Record<string, unknown>>(input);
  if (!value) return null;
  const domainId = normalizeString(value.domainId);
  const subjectId = normalizeString(value.subjectId);
  const subjectType = normalizeString(value.subjectType);
  const title = normalizeString(value.title);
  if (!domainId || !subjectId || !subjectType || !title) {
    return null;
  }
  return {
    domainId,
    subjectId,
    subjectType,
    title,
  };
}

function normalizeTargetSnapshot(input: unknown): AutomationTargetSnapshot | undefined {
  if (Array.isArray(input)) {
    const items = input
      .map((entry) => normalizeTargetSnapshotItem(entry))
      .filter((entry): entry is AutomationTargetSnapshotItem => Boolean(entry));
    return items;
  }

  return normalizeTargetSnapshotItem(input) || undefined;
}

function normalizeJob(raw: unknown): AutomationJob | null {
  const value = normalizeObject<Record<string, unknown>>(raw);
  if (!value) return null;
  const id = normalizeString(value.id);
  const title = normalizeString(value.title);
  const state = normalizeString(value.state);
  const triggerType = normalizeString(value.triggerType);
  const scheduledFor = normalizeString(value.scheduledFor);
  const targetSelector = normalizeAutomationTargetSelector(value.targetSelector);
  if (!id || !title || !scheduledFor || !targetSelector) return null;
  if (
    state !== 'pending' &&
    state !== 'eligible' &&
    state !== 'running' &&
    state !== 'completed' &&
    state !== 'failed_retryable' &&
    state !== 'failed_terminal' &&
    state !== 'cancelled' &&
    state !== 'expired'
  ) {
    return null;
  }
  if (
    triggerType !== 'one_time' &&
    triggerType !== 'schedule' &&
    triggerType !== 'retry' &&
    triggerType !== 'recovery'
  ) {
    return null;
  }
  return {
    id,
    title,
    sourceDraftId: normalizeString(value.sourceDraftId) || undefined,
    sourceRuleId: normalizeString(value.sourceRuleId) || undefined,
    domainId: normalizeString(value.domainId, 'football'),
    domainPackVersion: normalizeString(value.domainPackVersion) || undefined,
    templateId: normalizeString(value.templateId) || undefined,
    triggerType,
    targetSelector,
    targetSnapshot: normalizeTargetSnapshot(value.targetSnapshot),
    notificationPolicy: {
      notifyOnClarification:
        value.notificationPolicy &&
        typeof value.notificationPolicy === 'object'
          ? normalizeBoolean(
              (value.notificationPolicy as Record<string, unknown>).notifyOnClarification ??
                DEFAULT_AUTOMATION_NOTIFICATION_POLICY.notifyOnClarification,
            )
          : DEFAULT_AUTOMATION_NOTIFICATION_POLICY.notifyOnClarification,
      notifyOnStart:
        value.notificationPolicy &&
        typeof value.notificationPolicy === 'object'
          ? normalizeBoolean(
              (value.notificationPolicy as Record<string, unknown>).notifyOnStart ??
                DEFAULT_AUTOMATION_NOTIFICATION_POLICY.notifyOnStart,
            )
          : DEFAULT_AUTOMATION_NOTIFICATION_POLICY.notifyOnStart,
      notifyOnComplete:
        value.notificationPolicy &&
        typeof value.notificationPolicy === 'object'
          ? normalizeBoolean(
              (value.notificationPolicy as Record<string, unknown>).notifyOnComplete ??
                DEFAULT_AUTOMATION_NOTIFICATION_POLICY.notifyOnComplete,
            )
          : DEFAULT_AUTOMATION_NOTIFICATION_POLICY.notifyOnComplete,
      notifyOnFailure:
        value.notificationPolicy &&
        typeof value.notificationPolicy === 'object'
          ? normalizeBoolean(
              (value.notificationPolicy as Record<string, unknown>).notifyOnFailure ??
                DEFAULT_AUTOMATION_NOTIFICATION_POLICY.notifyOnFailure,
            )
          : DEFAULT_AUTOMATION_NOTIFICATION_POLICY.notifyOnFailure,
    },
    analysisProfile: normalizeAutomationAnalysisProfile(value.analysisProfile),
    scheduledFor,
    state,
    retryCount: normalizeTimestamp(value.retryCount, 0),
    maxRetries: normalizeTimestamp(value.maxRetries, 2),
    retryAfter: normalizeString(value.retryAfter) || null,
    recoveryWindowEndsAt: normalizeString(value.recoveryWindowEndsAt) || null,
    createdAt: normalizeTimestamp(value.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(value.updatedAt, Date.now()),
  };
}

export async function listAutomationJobs(
  options?: AutomationJobQueryOptions,
): Promise<AutomationJob[]> {
  const jobs = readAutomationRecords(AUTOMATION_JOBS_STORAGE_KEY, {
    normalizer: normalizeJob,
  });
  const filtered =
    Array.isArray(options?.states) && options.states.length > 0
      ? jobs.filter((job) => options.states!.includes(job.state))
      : jobs;
  return sortByScheduledForAsc(filtered);
}

export async function saveAutomationJob(job: AutomationJob): Promise<void> {
  const current = await listAutomationJobs();
  const next = current.filter((entry) => entry.id !== job.id);
  next.push({
    ...job,
    updatedAt: Date.now(),
  });
  writeAutomationRecords(AUTOMATION_JOBS_STORAGE_KEY, next, {
    sort: (a, b) =>
      new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
    limit: MAX_AUTOMATION_JOB_COUNT,
  });
}

export async function deleteAutomationJob(jobId: string): Promise<void> {
  const current = await listAutomationJobs();
  writeAutomationRecords(
    AUTOMATION_JOBS_STORAGE_KEY,
    current.filter((entry) => entry.id !== jobId),
    {
      sort: (a, b) =>
        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
      limit: MAX_AUTOMATION_JOB_COUNT,
    },
  );
}

export async function getAutomationJob(jobId: string): Promise<AutomationJob | null> {
  const jobs = await listAutomationJobs();
  return jobs.find((job) => job.id === jobId) || null;
}
