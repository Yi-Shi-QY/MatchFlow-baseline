import { computeNextScheduleOccurrence } from './time';
import { saveAutomationJob } from './jobStore';
import { scheduleNativeAutomationSync } from './nativeScheduler';
import { saveAutomationRule } from './ruleStore';
import type { AutomationDraft, AutomationJob, AutomationRule } from './types';
import { createAutomationId } from './utils';

export async function activateAutomationDraft(draft: AutomationDraft): Promise<void> {
  if (draft.status !== 'ready' || !draft.schedule || !draft.targetSelector) {
    throw new Error('Only ready drafts can be activated.');
  }

  const timestamp = Date.now();

  if (draft.intentType === 'recurring') {
    const rule: AutomationRule = {
      id: createAutomationId('automation_rule'),
      title: draft.title,
      enabled: true,
      sourceDraftId: draft.id,
      domainId: draft.domainId,
      domainPackVersion: draft.domainPackVersion,
      templateId: draft.templateId,
      schedule: draft.schedule,
      targetSelector: draft.targetSelector,
      executionPolicy: draft.executionPolicy,
      notificationPolicy: draft.notificationPolicy,
      analysisProfile: draft.analysisProfile,
      nextPlannedAt: computeNextScheduleOccurrence(draft.schedule),
      timezone: draft.schedule.timezone,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await saveAutomationRule(rule);
    scheduleNativeAutomationSync('automation_rule_activated');
    return;
  }

  if (draft.schedule.type !== 'one_time') {
    throw new Error('One-time activation requires a one-time schedule.');
  }

  const recoveryWindowEndsAt = new Date(
    new Date(draft.schedule.runAt).getTime() +
      draft.executionPolicy.recoveryWindowMinutes * 60_000,
  ).toISOString();

  const job: AutomationJob = {
    id: createAutomationId('automation_job'),
    title: draft.title,
    sourceDraftId: draft.id,
    domainId: draft.domainId,
    domainPackVersion: draft.domainPackVersion,
    templateId: draft.templateId,
    triggerType: 'one_time',
    targetSelector: draft.targetSelector,
    notificationPolicy: draft.notificationPolicy,
    analysisProfile: draft.analysisProfile,
    scheduledFor: draft.schedule.runAt,
    state: 'pending',
    retryCount: 0,
    maxRetries: draft.executionPolicy.maxRetries,
    retryAfter: null,
    recoveryWindowEndsAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await saveAutomationJob(job);
  scheduleNativeAutomationSync('automation_job_activated');
}
