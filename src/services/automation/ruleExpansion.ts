import { saveAutomationJob } from './jobStore';
import { scheduleNativeAutomationSync } from './nativeScheduler';
import { saveAutomationRule } from './ruleStore';
import {
  computeDailyRecoveryWindowEnd,
  computeFollowingScheduleOccurrence,
  computeNextScheduleOccurrence,
  computeOneTimeRecoveryWindowEnd,
  isSameLocalDay,
  parseAutomationTimestamp,
} from './time';
import type { AutomationJob, AutomationRule } from './types';
import { createAutomationId } from './utils';

export interface RuleExpansionOptions {
  now?: Date;
  lookaheadMs?: number;
}

export interface RuleExpansionResult {
  createdJobs: AutomationJob[];
  updatedRules: AutomationRule[];
  skippedDuplicateCount: number;
  skippedPastOccurrenceCount: number;
}

function buildRuleWindowFingerprint(rule: AutomationRule, scheduledFor: string): string {
  return [
    rule.id,
    rule.domainId,
    scheduledFor,
    JSON.stringify(rule.targetSelector),
  ].join('::');
}

function buildExistingWindowSet(existingJobs: AutomationJob[]): Set<string> {
  const fingerprints = new Set<string>();
  existingJobs.forEach((job) => {
    if (!job.sourceRuleId) {
      return;
    }
    fingerprints.add(
      [
        job.sourceRuleId,
        job.domainId,
        job.scheduledFor,
        JSON.stringify(job.targetSelector),
      ].join('::'),
    );
  });
  return fingerprints;
}

function shouldMaterializeRuleOccurrence(
  rule: AutomationRule,
  occurrenceIso: string,
  now: Date,
): boolean {
  const occurrenceMs = parseAutomationTimestamp(occurrenceIso);
  if (occurrenceMs === null) {
    return false;
  }

  if (occurrenceMs >= now.getTime()) {
    return true;
  }

  if (rule.schedule.type === 'daily') {
    return isSameLocalDay(occurrenceIso, now);
  }

  return true;
}

function computeRecoveryWindowEndsAt(rule: AutomationRule, scheduledFor: string): string | null {
  if (rule.schedule.type === 'daily') {
    return computeDailyRecoveryWindowEnd(
      scheduledFor,
      rule.executionPolicy.recoveryWindowMinutes,
    );
  }

  return computeOneTimeRecoveryWindowEnd(
    scheduledFor,
    rule.executionPolicy.recoveryWindowMinutes,
  );
}

export function expandAutomationRules(
  rules: AutomationRule[],
  existingJobs: AutomationJob[],
  options: RuleExpansionOptions = {},
): RuleExpansionResult {
  const now = options.now || new Date();
  const lookaheadMs = Math.max(0, Math.floor(options.lookaheadMs || 0));
  const expansionHorizonMs = now.getTime() + lookaheadMs;
  const existingWindowSet = buildExistingWindowSet(existingJobs);
  const createdJobs: AutomationJob[] = [];
  const updatedRules: AutomationRule[] = [];
  let skippedDuplicateCount = 0;
  let skippedPastOccurrenceCount = 0;

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    let nextOccurrence =
      rule.nextPlannedAt || computeNextScheduleOccurrence(rule.schedule, now) || null;

    if (!nextOccurrence) {
      updatedRules.push({
        ...rule,
        nextPlannedAt: null,
      });
      continue;
    }

    while (true) {
      const nextOccurrenceMs = parseAutomationTimestamp(nextOccurrence);
      if (nextOccurrenceMs === null || nextOccurrenceMs > expansionHorizonMs) {
        break;
      }

      const fingerprint = buildRuleWindowFingerprint(rule, nextOccurrence);
      const shouldMaterialize = shouldMaterializeRuleOccurrence(rule, nextOccurrence, now);

      if (shouldMaterialize) {
        if (!existingWindowSet.has(fingerprint)) {
          const createdAt = Date.now();
          createdJobs.push({
            id: createAutomationId('automation_job'),
            title: rule.title,
            sourceDraftId: rule.sourceDraftId,
            sourceRuleId: rule.id,
            domainId: rule.domainId,
            domainPackVersion: rule.domainPackVersion,
            templateId: rule.templateId,
            triggerType: 'schedule',
            targetSelector: rule.targetSelector,
            notificationPolicy: rule.notificationPolicy,
            analysisProfile: rule.analysisProfile,
            scheduledFor: nextOccurrence,
            state: 'pending',
            retryCount: 0,
            maxRetries: rule.executionPolicy.maxRetries,
            retryAfter: null,
            recoveryWindowEndsAt: computeRecoveryWindowEndsAt(rule, nextOccurrence),
            createdAt,
            updatedAt: createdAt,
          });
          existingWindowSet.add(fingerprint);
        } else {
          skippedDuplicateCount += 1;
        }
      } else {
        skippedPastOccurrenceCount += 1;
      }

      const following = computeFollowingScheduleOccurrence(rule.schedule, nextOccurrence);
      if (!following || following === nextOccurrence) {
        nextOccurrence = null;
        break;
      }
      nextOccurrence = following;
    }

    updatedRules.push({
      ...rule,
      nextPlannedAt: nextOccurrence,
      updatedAt: Date.now(),
    });
  }

  return {
    createdJobs,
    updatedRules,
    skippedDuplicateCount,
    skippedPastOccurrenceCount,
  };
}

export async function persistRuleExpansionResult(result: RuleExpansionResult): Promise<void> {
  for (const job of result.createdJobs) {
    await saveAutomationJob(job);
  }

  for (const rule of result.updatedRules) {
    await saveAutomationRule(rule);
  }

  scheduleNativeAutomationSync('automation_rule_expansion_persisted');
}
