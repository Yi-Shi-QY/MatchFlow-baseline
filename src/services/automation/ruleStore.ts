import {
  AUTOMATION_RULES_STORAGE_KEY,
  MAX_AUTOMATION_RULE_COUNT,
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
  AutomationRule,
  AutomationRuleQueryOptions,
  AutomationSchedule,
  AutomationTargetSelector,
} from './types';
import { sortByUpdatedAtDesc } from './utils';

function normalizeSchedule(input: unknown): AutomationSchedule | undefined {
  const value = normalizeObject<Record<string, unknown>>(input);
  if (!value || typeof value.type !== 'string') return undefined;
  if (value.type === 'daily' && typeof value.time === 'string' && typeof value.timezone === 'string') {
    return { type: 'daily', time: value.time, timezone: value.timezone };
  }
  if (value.type === 'one_time' && typeof value.runAt === 'string' && typeof value.timezone === 'string') {
    return { type: 'one_time', runAt: value.runAt, timezone: value.timezone };
  }
  return undefined;
}

function normalizeTargetSelector(input: unknown): AutomationTargetSelector | undefined {
  const value = normalizeObject<Record<string, unknown>>(input);
  if (!value || typeof value.mode !== 'string') return undefined;
  if (value.mode === 'league_query' && typeof value.leagueKey === 'string' && typeof value.leagueLabel === 'string') {
    return { mode: 'league_query', leagueKey: value.leagueKey, leagueLabel: value.leagueLabel };
  }
  if (value.mode === 'server_resolve' && typeof value.queryText === 'string' && typeof value.displayLabel === 'string') {
    return { mode: 'server_resolve', queryText: value.queryText, displayLabel: value.displayLabel };
  }
  if (value.mode === 'fixed_subject' && typeof value.subjectId === 'string' && typeof value.subjectLabel === 'string') {
    return { mode: 'fixed_subject', subjectId: value.subjectId, subjectLabel: value.subjectLabel };
  }
  return undefined;
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

function normalizeRule(raw: unknown): AutomationRule | null {
  const value = normalizeObject<Record<string, unknown>>(raw);
  if (!value) return null;
  const id = normalizeString(value.id);
  const title = normalizeString(value.title);
  const domainId = normalizeString(value.domainId, 'football');
  const schedule = normalizeSchedule(value.schedule);
  const targetSelector = normalizeTargetSelector(value.targetSelector);
  if (!id || !title || !schedule || !targetSelector) return null;
  return {
    id,
    title,
    enabled: normalizeBoolean(value.enabled, true),
    sourceDraftId: normalizeString(value.sourceDraftId) || undefined,
    domainId,
    domainPackVersion: normalizeString(value.domainPackVersion) || undefined,
    templateId: normalizeString(value.templateId) || undefined,
    schedule,
    targetSelector,
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
      notifyOnClarification: true,
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
    nextPlannedAt: normalizeString(value.nextPlannedAt) || null,
    timezone: normalizeString(value.timezone, schedule.timezone),
    createdAt: normalizeTimestamp(value.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(value.updatedAt, Date.now()),
  };
}

export async function listAutomationRules(
  options?: AutomationRuleQueryOptions,
): Promise<AutomationRule[]> {
  const rules = readAutomationRecords(AUTOMATION_RULES_STORAGE_KEY, {
    normalizer: normalizeRule,
  });
  const filtered =
    typeof options?.enabled === 'boolean'
      ? rules.filter((rule) => rule.enabled === options.enabled)
      : rules;
  return sortByUpdatedAtDesc(filtered);
}

export async function saveAutomationRule(rule: AutomationRule): Promise<void> {
  const current = await listAutomationRules();
  const next = current.filter((entry) => entry.id !== rule.id);
  next.unshift({
    ...rule,
    updatedAt: Date.now(),
  });
  writeAutomationRecords(AUTOMATION_RULES_STORAGE_KEY, next, {
    sort: (a, b) => b.updatedAt - a.updatedAt,
    limit: MAX_AUTOMATION_RULE_COUNT,
  });
}

export async function deleteAutomationRule(ruleId: string): Promise<void> {
  const current = await listAutomationRules();
  writeAutomationRecords(
    AUTOMATION_RULES_STORAGE_KEY,
    current.filter((entry) => entry.id !== ruleId),
    {
      sort: (a, b) => b.updatedAt - a.updatedAt,
      limit: MAX_AUTOMATION_RULE_COUNT,
    },
  );
}
