import { DEFAULT_AUTOMATION_EXECUTION_POLICY } from './constants';
import { normalizeAutomationExecutionTargetExpansion } from './executionPolicy';
import { normalizeObject } from './storageFallback';
import { normalizeAutomationTargetSelectorRecord } from './targetSelector';
import type {
  AutomationAnalysisProfile,
  AutomationExecutionPolicy,
  AutomationSchedule,
  AutomationTargetSelector,
} from './types';

export function normalizeAutomationSchedule(
  input: unknown,
): AutomationSchedule | undefined {
  const value = normalizeObject<Record<string, unknown>>(input);
  if (!value || typeof value.type !== 'string') {
    return undefined;
  }

  if (
    value.type === 'daily' &&
    typeof value.time === 'string' &&
    typeof value.timezone === 'string'
  ) {
    return {
      type: 'daily',
      time: value.time,
      timezone: value.timezone,
    };
  }

  if (
    value.type === 'one_time' &&
    typeof value.runAt === 'string' &&
    typeof value.timezone === 'string'
  ) {
    return {
      type: 'one_time',
      runAt: value.runAt,
      timezone: value.timezone,
    };
  }

  return undefined;
}

export function normalizeAutomationTargetSelector(
  input: unknown,
): AutomationTargetSelector | undefined {
  return normalizeAutomationTargetSelectorRecord(input);
}

export function normalizeAutomationAnalysisProfile(
  input: unknown,
): AutomationAnalysisProfile | undefined {
  const value = normalizeObject<Record<string, unknown>>(input);
  if (!value) {
    return undefined;
  }

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

export function normalizeAutomationExecutionPolicy(
  input: unknown,
): AutomationExecutionPolicy {
  const value = normalizeObject<Record<string, unknown>>(input);

  return {
    targetExpansion: normalizeAutomationExecutionTargetExpansion(
      value?.targetExpansion,
      DEFAULT_AUTOMATION_EXECUTION_POLICY.targetExpansion,
    ),
    recoveryWindowMinutes:
      typeof value?.recoveryWindowMinutes === 'number'
        ? Number(value.recoveryWindowMinutes)
        : DEFAULT_AUTOMATION_EXECUTION_POLICY.recoveryWindowMinutes,
    maxRetries:
      typeof value?.maxRetries === 'number'
        ? Number(value.maxRetries)
        : DEFAULT_AUTOMATION_EXECUTION_POLICY.maxRetries,
  };
}
