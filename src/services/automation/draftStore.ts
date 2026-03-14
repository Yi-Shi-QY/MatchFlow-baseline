import {
  AUTOMATION_DRAFTS_STORAGE_KEY,
  MAX_AUTOMATION_DRAFT_COUNT,
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
  AutomationDraftActivationMode,
  AutomationClarificationState,
  AutomationDraft,
  AutomationDraftQueryOptions,
} from './types';
import {
  normalizeAutomationAnalysisProfile,
  normalizeAutomationExecutionPolicy,
  normalizeAutomationSchedule,
  normalizeAutomationTargetSelector,
} from './recordNormalizers';
import { sortByUpdatedAtDesc } from './utils';

function normalizeClarificationState(input: unknown): AutomationClarificationState {
  const value = normalizeObject<Record<string, unknown>>(input);
  return {
    roundsUsed: normalizeTimestamp(value?.roundsUsed, 0),
    lastQuestion:
      value?.lastQuestion && typeof value.lastQuestion === 'object'
        ? (value.lastQuestion as AutomationClarificationState['lastQuestion'])
        : undefined,
  };
}

function normalizeActivationMode(input: unknown): AutomationDraftActivationMode {
  return input === 'run_now' ? 'run_now' : 'save_only';
}

function normalizeDraft(raw: unknown): AutomationDraft | null {
  const value = normalizeObject<Record<string, unknown>>(raw);
  if (!value) return null;
  const status = normalizeString(value.status);
  const intentType = normalizeString(value.intentType);
  if (
    status !== 'ready' &&
    status !== 'needs_clarification' &&
    status !== 'rejected'
  ) {
    return null;
  }
  if (intentType !== 'one_time' && intentType !== 'recurring') {
    return null;
  }
  const id = normalizeString(value.id);
  const sourceText = normalizeString(value.sourceText);
  const title = normalizeString(value.title, sourceText);
  const domainId = normalizeString(value.domainId, 'football');
  if (!id || !sourceText) return null;
  return {
    id,
    sourceText,
    title,
    status,
    intentType,
    activationMode: normalizeActivationMode(value.activationMode),
    domainId,
    domainPackVersion: normalizeString(value.domainPackVersion) || undefined,
    templateId: normalizeString(value.templateId) || undefined,
    schedule: normalizeAutomationSchedule(value.schedule),
    targetSelector: normalizeAutomationTargetSelector(value.targetSelector),
    executionPolicy: normalizeAutomationExecutionPolicy(value.executionPolicy),
    notificationPolicy: {
      notifyOnClarification:
        value.notificationPolicy &&
        typeof value.notificationPolicy === 'object'
          ? normalizeBoolean((value.notificationPolicy as Record<string, unknown>).notifyOnClarification, true)
          : true,
      notifyOnStart:
        value.notificationPolicy &&
        typeof value.notificationPolicy === 'object'
          ? normalizeBoolean((value.notificationPolicy as Record<string, unknown>).notifyOnStart, false)
          : false,
      notifyOnComplete:
        value.notificationPolicy &&
        typeof value.notificationPolicy === 'object'
          ? normalizeBoolean((value.notificationPolicy as Record<string, unknown>).notifyOnComplete, true)
          : true,
      notifyOnFailure:
        value.notificationPolicy &&
        typeof value.notificationPolicy === 'object'
          ? normalizeBoolean((value.notificationPolicy as Record<string, unknown>).notifyOnFailure, true)
          : true,
    },
    analysisProfile: normalizeAutomationAnalysisProfile(value.analysisProfile),
    clarificationState: normalizeClarificationState(value.clarificationState),
    rejectionReason: normalizeString(value.rejectionReason) || undefined,
    createdAt: normalizeTimestamp(value.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(value.updatedAt, Date.now()),
  };
}

export async function listAutomationDrafts(
  options?: AutomationDraftQueryOptions,
): Promise<AutomationDraft[]> {
  const drafts = readAutomationRecords(AUTOMATION_DRAFTS_STORAGE_KEY, {
    normalizer: normalizeDraft,
  });
  const filtered =
    Array.isArray(options?.statuses) && options.statuses.length > 0
      ? drafts.filter((draft) => options.statuses!.includes(draft.status))
      : drafts;
  return sortByUpdatedAtDesc(filtered);
}

export async function saveAutomationDraft(draft: AutomationDraft): Promise<void> {
  const current = await listAutomationDrafts();
  const next = current.filter((entry) => entry.id !== draft.id);
  next.unshift({
    ...draft,
    updatedAt: Date.now(),
  });
  writeAutomationRecords(AUTOMATION_DRAFTS_STORAGE_KEY, next, {
    sort: (a, b) => b.updatedAt - a.updatedAt,
    limit: MAX_AUTOMATION_DRAFT_COUNT,
  });
}

export async function saveAutomationDrafts(drafts: AutomationDraft[]): Promise<void> {
  for (const draft of drafts) {
    await saveAutomationDraft(draft);
  }
}

export async function deleteAutomationDraft(draftId: string): Promise<void> {
  const current = await listAutomationDrafts();
  writeAutomationRecords(
    AUTOMATION_DRAFTS_STORAGE_KEY,
    current.filter((entry) => entry.id !== draftId),
    {
      sort: (a, b) => b.updatedAt - a.updatedAt,
      limit: MAX_AUTOMATION_DRAFT_COUNT,
    },
  );
}

export async function getAutomationDraft(draftId: string): Promise<AutomationDraft | null> {
  const drafts = await listAutomationDrafts();
  return drafts.find((entry) => entry.id === draftId) || null;
}
