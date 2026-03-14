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
  AutomationRule,
  AutomationRuleQueryOptions,
} from './types';
import {
  normalizeAutomationAnalysisProfile,
  normalizeAutomationExecutionPolicy,
  normalizeAutomationSchedule,
  normalizeAutomationTargetSelector,
} from './recordNormalizers';
import { sortByUpdatedAtDesc } from './utils';

function normalizeRule(raw: unknown): AutomationRule | null {
  const value = normalizeObject<Record<string, unknown>>(raw);
  if (!value) return null;
  const id = normalizeString(value.id);
  const title = normalizeString(value.title);
  const domainId = normalizeString(value.domainId, 'football');
  const schedule = normalizeAutomationSchedule(value.schedule);
  const targetSelector = normalizeAutomationTargetSelector(value.targetSelector);
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
    executionPolicy: normalizeAutomationExecutionPolicy(value.executionPolicy),
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
    analysisProfile: normalizeAutomationAnalysisProfile(value.analysisProfile),
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
