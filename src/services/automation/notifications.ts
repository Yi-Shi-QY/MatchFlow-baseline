import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { buildSubjectRoute } from '@/src/services/navigation/subjectRoute';
import { getSettings } from '@/src/services/settings';
import { detectAutomationHostType } from './concurrencyBudget';
import type {
  AutomationDraft,
  AutomationJob,
  AutomationRun,
  AutomationTargetSnapshotItem,
} from './types';

interface AutomationNotificationDescriptor {
  id: number;
  title: string;
  body: string;
  route: string;
  extra?: Record<string, unknown>;
}

function hashNotificationKey(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 1_000_000_000;
  }
  return 20_000_000 + hash;
}

function buildNotificationId(scope: string, entityId: string): number {
  return hashNotificationKey(`${scope}:${entityId}`);
}

function isSubjectSnapshotItem(input: unknown): input is AutomationTargetSnapshotItem {
  return (
    !!input &&
    typeof input === 'object' &&
    typeof (input as { subjectId?: unknown }).subjectId === 'string' &&
    typeof (input as { domainId?: unknown }).domainId === 'string'
  );
}

function isSubjectSnapshotArray(input: unknown): input is AutomationTargetSnapshotItem[] {
  return Array.isArray(input) && input.every((entry) => isSubjectSnapshotItem(entry));
}

function parseHistorySubjectKey(
  input: string | undefined,
): { domainId: string; subjectId: string } | null {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return null;
  }
  const separatorIndex = input.indexOf('::');
  if (separatorIndex <= 0) {
    return null;
  }
  const domainId = input.slice(0, separatorIndex).trim();
  const subjectId = input.slice(separatorIndex + 2).trim();
  if (!domainId || !subjectId) {
    return null;
  }
  return { domainId, subjectId };
}

function resolveSingleSubjectRoute(job: AutomationJob, run?: AutomationRun): string | null {
  if (job.targetSelector.mode === 'fixed_subject') {
    return buildSubjectRoute(job.domainId, job.targetSelector.subjectId);
  }

  if (isSubjectSnapshotArray(job.targetSnapshot)) {
    if (job.targetSnapshot.length === 1) {
      return buildSubjectRoute(
        job.targetSnapshot[0].domainId,
        job.targetSnapshot[0].subjectId,
      );
    }
    return null;
  }

  if (isSubjectSnapshotItem(job.targetSnapshot)) {
    return buildSubjectRoute(job.targetSnapshot.domainId, job.targetSnapshot.subjectId);
  }

  const historySubject = parseHistorySubjectKey(run?.resultHistoryId);
  if (historySubject) {
    return buildSubjectRoute(historySubject.domainId, historySubject.subjectId);
  }

  return null;
}

function isAutomationNotificationEnabled(): boolean {
  const settings = getSettings();
  if (!settings.enableBackgroundMode) {
    return false;
  }
  return detectAutomationHostType() !== 'browser_web';
}

async function scheduleNativeAutomationNotification(
  descriptor: AutomationNotificationDescriptor,
): Promise<boolean> {
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    return false;
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: descriptor.id,
        title: descriptor.title,
        body: descriptor.body,
        schedule: { at: new Date(Date.now() + 100) },
        extra: {
          route: descriptor.route,
          ...descriptor.extra,
        } as any,
      },
    ],
  });
  return true;
}

function scheduleBrowserAutomationNotification(
  descriptor: AutomationNotificationDescriptor,
): boolean {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const notification = new Notification(descriptor.title, {
    body: descriptor.body,
    tag: `matchflow-automation-${descriptor.id}`,
    data: {
      route: descriptor.route,
      ...descriptor.extra,
    },
  });
  notification.onclick = () => {
    try {
      window.focus?.();
      if (descriptor.route.startsWith('/')) {
        window.location.assign(descriptor.route);
      }
    } finally {
      notification.close();
    }
  };
  return true;
}

async function scheduleAutomationNotification(
  descriptor: AutomationNotificationDescriptor,
): Promise<boolean> {
  if (!isAutomationNotificationEnabled()) {
    return false;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      return await scheduleNativeAutomationNotification(descriptor);
    }
    return scheduleBrowserAutomationNotification(descriptor);
  } catch (error) {
    console.warn('Failed to schedule automation notification.', error);
    return false;
  }
}

function resolveCopy() {
  const language = getSettings().language === 'zh' ? 'zh' : 'en';
  if (language === 'zh') {
    return {
      clarificationTitle: '自动化任务需要补充信息',
      clarificationBody: '打开自动化中心并回答一个问题后继续执行。',
      startedTitle: '自动分析已开始',
      completedTitle: '自动分析已完成',
      completedBody: '点击查看本次自动分析结果。',
      failedTitle: '自动分析失败',
      failedBody: '打开自动化中心查看失败原因并决定是否重试。',
    };
  }
  return {
    clarificationTitle: 'Automation needs clarification',
    clarificationBody: 'Open the automation hub and answer one question to continue.',
    startedTitle: 'Automation started',
    completedTitle: 'Automation completed',
    completedBody: 'Tap to review the latest automation result.',
    failedTitle: 'Automation failed',
    failedBody: 'Open the automation hub to inspect the failure and retry.',
  };
}

export function buildAutomationNotificationRoute(input?: {
  draftId?: string | null;
  jobId?: string | null;
  runId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (typeof input?.draftId === 'string' && input.draftId.trim().length > 0) {
    params.set('draftId', input.draftId.trim());
  }
  if (typeof input?.jobId === 'string' && input.jobId.trim().length > 0) {
    params.set('jobId', input.jobId.trim());
  }
  if (typeof input?.runId === 'string' && input.runId.trim().length > 0) {
    params.set('runId', input.runId.trim());
  }
  const query = params.toString();
  return query ? `/automation?${query}` : '/automation';
}

export function resolveAutomationRunNotificationRoute(
  job: AutomationJob,
  run: AutomationRun,
): string {
  if (run.state === 'completed') {
    const subjectRoute = resolveSingleSubjectRoute(job, run);
    if (subjectRoute) {
      return subjectRoute;
    }
  }

  return buildAutomationNotificationRoute({
    jobId: job.id,
    runId: run.id,
  });
}

export async function notifyAutomationClarificationNeeded(
  draft: AutomationDraft,
): Promise<boolean> {
  const copy = resolveCopy();
  return scheduleAutomationNotification({
    id: buildNotificationId('automation-draft-clarify', draft.id),
    title: copy.clarificationTitle,
    body: draft.title || copy.clarificationBody,
    route: buildAutomationNotificationRoute({
      draftId: draft.id,
    }),
    extra: {
      draftId: draft.id,
    },
  });
}

export async function notifyAutomationRunStarted(
  job: AutomationJob,
  run: AutomationRun,
): Promise<boolean> {
  const copy = resolveCopy();
  return scheduleAutomationNotification({
    id: buildNotificationId('automation-run-started', run.id),
    title: copy.startedTitle,
    body: job.title,
    route: buildAutomationNotificationRoute({
      jobId: job.id,
      runId: run.id,
    }),
    extra: {
      jobId: job.id,
      runId: run.id,
    },
  });
}

export async function notifyAutomationRunCompleted(
  job: AutomationJob,
  run: AutomationRun,
): Promise<boolean> {
  const copy = resolveCopy();
  return scheduleAutomationNotification({
    id: buildNotificationId('automation-run-completed', run.id),
    title: copy.completedTitle,
    body: job.title || copy.completedBody,
    route: resolveAutomationRunNotificationRoute(job, run),
    extra: {
      jobId: job.id,
      runId: run.id,
      resultHistoryId: run.resultHistoryId,
    },
  });
}

export async function notifyAutomationRunFailed(
  job: AutomationJob,
  run: AutomationRun,
): Promise<boolean> {
  const copy = resolveCopy();
  return scheduleAutomationNotification({
    id: buildNotificationId('automation-run-failed', run.id),
    title: copy.failedTitle,
    body: run.errorMessage || job.title || copy.failedBody,
    route: buildAutomationNotificationRoute({
      jobId: job.id,
      runId: run.id,
    }),
    extra: {
      jobId: job.id,
      runId: run.id,
    },
  });
}
