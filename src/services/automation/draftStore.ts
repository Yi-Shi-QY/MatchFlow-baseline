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
  AutomationAnalysisProfile,
  AutomationDraftActivationMode,
  AutomationClarificationState,
  AutomationDraft,
  AutomationDraftQueryOptions,
  AutomationSchedule,
  AutomationTargetSelector,
} from './types';
import { sortByUpdatedAtDesc } from './utils';

function normalizeSchedule(input: unknown): AutomationSchedule | undefined {
  const value = normalizeObject<Record<string, unknown>>(input);
  if (!value || typeof value.type !== 'string') return undefined;
  if (value.type === 'daily' && typeof value.time === 'string' && typeof value.timezone === 'string') {
    return {
      type: 'daily',
      time: value.time,
      timezone: value.timezone,
    };
  }
  if (value.type === 'one_time' && typeof value.runAt === 'string' && typeof value.timezone === 'string') {
    return {
      type: 'one_time',
      runAt: value.runAt,
      timezone: value.timezone,
    };
  }
  return undefined;
}

function normalizeTargetSelector(input: unknown): AutomationTargetSelector | undefined {
  const value = normalizeObject<Record<string, unknown>>(input);
  if (!value || typeof value.mode !== 'string') return undefined;
  if (
    value.mode === 'league_query' &&
    typeof value.leagueKey === 'string' &&
    typeof value.leagueLabel === 'string'
  ) {
    return {
      mode: 'league_query',
      leagueKey: value.leagueKey,
      leagueLabel: value.leagueLabel,
    };
  }
  if (
    value.mode === 'server_resolve' &&
    typeof value.queryText === 'string' &&
    typeof value.displayLabel === 'string'
  ) {
    return {
      mode: 'server_resolve',
      queryText: value.queryText,
      displayLabel: value.displayLabel,
    };
  }
  if (
    value.mode === 'fixed_subject' &&
    typeof value.subjectId === 'string' &&
    typeof value.subjectLabel === 'string'
  ) {
    return {
      mode: 'fixed_subject',
      subjectId: value.subjectId,
      subjectLabel: value.subjectLabel,
    };
  }
  return undefined;
}

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

function normalizeAnalysisProfile(input: unknown): AutomationAnalysisProfile | undefined {
  const value = normalizeObject<Record<string, unknown>>(input);
  if (!value) return undefined;
  const selectedSourceIds = Array.isArray(value.selectedSourceIds)
    ? value.selectedSourceIds.filter(
        (entry): entry is AutomationAnalysisProfile['selectedSourceIds'][number] =>
          entry === 'fundamental' || entry === 'market' || entry === 'custom',
      )
    : [];
  const sequencePreference = Array.isArray(value.sequencePreference)
    ? value.sequencePreference.filter(
        (entry): entry is AutomationAnalysisProfile['sequencePreference'][number] =>
          entry === 'fundamental' ||
          entry === 'market' ||
          entry === 'custom' ||
          entry === 'prediction',
      )
    : [];
  if (selectedSourceIds.length === 0 && sequencePreference.length === 0) {
    return undefined;
  }
  return {
    selectedSourceIds,
    sequencePreference,
  };
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
    schedule: normalizeSchedule(value.schedule),
    targetSelector: normalizeTargetSelector(value.targetSelector),
    executionPolicy: {
      targetExpansion:
        value.executionPolicy &&
        typeof value.executionPolicy === 'object' &&
        (value.executionPolicy as Record<string, unknown>).targetExpansion === 'all_matches'
          ? 'all_matches'
          : 'single',
      recoveryWindowMinutes:
        value.executionPolicy &&
        typeof value.executionPolicy === 'object' &&
        typeof (value.executionPolicy as Record<string, unknown>).recoveryWindowMinutes === 'number'
          ? Number((value.executionPolicy as Record<string, unknown>).recoveryWindowMinutes)
          : 30,
      maxRetries:
        value.executionPolicy &&
        typeof value.executionPolicy === 'object' &&
        typeof (value.executionPolicy as Record<string, unknown>).maxRetries === 'number'
          ? Number((value.executionPolicy as Record<string, unknown>).maxRetries)
          : 2,
    },
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
    analysisProfile: normalizeAnalysisProfile(value.analysisProfile),
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
