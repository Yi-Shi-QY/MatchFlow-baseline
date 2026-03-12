import { describe, expect, it } from 'vitest';
import { expandAutomationRules } from '@/src/services/automation/ruleExpansion';
import type { AutomationRule } from '@/src/services/automation/types';

function createDailyRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  const now = Date.now();
  return {
    id: 'rule-1',
    title: 'Premier League daily scan',
    enabled: true,
    sourceDraftId: 'draft-1',
    domainId: 'football',
    domainPackVersion: undefined,
    templateId: undefined,
    schedule: {
      type: 'daily',
      time: '09:00',
      timezone: 'Asia/Shanghai',
    },
    targetSelector: {
      mode: 'league_query',
      leagueKey: 'premier_league',
      leagueLabel: 'Premier League',
    },
    executionPolicy: {
      targetExpansion: 'all_matches',
      recoveryWindowMinutes: 30,
      maxRetries: 2,
    },
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: false,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    nextPlannedAt: null,
    timezone: 'Asia/Shanghai',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('expandAutomationRules', () => {
  it('deduplicates an already materialized recurring window and advances nextPlannedAt', () => {
    const dueAt = new Date(2026, 2, 11, 9, 0, 0, 0);
    const now = new Date(2026, 2, 11, 10, 0, 0, 0);
    const rule = createDailyRule({
      nextPlannedAt: dueAt.toISOString(),
    });

    const result = expandAutomationRules(
      [rule],
      [
        {
          id: 'job-1',
          title: rule.title,
          sourceDraftId: rule.sourceDraftId,
          sourceRuleId: rule.id,
          domainId: rule.domainId,
          domainPackVersion: undefined,
          templateId: undefined,
          triggerType: 'schedule',
          targetSelector: rule.targetSelector,
          notificationPolicy: rule.notificationPolicy,
          scheduledFor: dueAt.toISOString(),
          state: 'completed',
          retryCount: 0,
          maxRetries: 2,
          retryAfter: null,
          recoveryWindowEndsAt: new Date(2026, 2, 11, 9, 30, 0, 0).toISOString(),
          createdAt: now.getTime(),
          updatedAt: now.getTime(),
        },
      ],
      { now },
    );

    expect(result.createdJobs).toHaveLength(0);
    expect(result.skippedDuplicateCount).toBe(1);
    expect(result.updatedRules[0].nextPlannedAt).toBe(new Date(2026, 2, 12, 9, 0, 0, 0).toISOString());
  });

  it('skips previous-day occurrences but creates the current-day missed window', () => {
    const rule = createDailyRule({
      nextPlannedAt: new Date(2026, 2, 10, 9, 0, 0, 0).toISOString(),
    });
    const now = new Date(2026, 2, 11, 10, 0, 0, 0);

    const result = expandAutomationRules([rule], [], { now });

    expect(result.skippedPastOccurrenceCount).toBe(1);
    expect(result.createdJobs).toHaveLength(1);
    expect(result.createdJobs[0].scheduledFor).toBe(new Date(2026, 2, 11, 9, 0, 0, 0).toISOString());
    expect(result.createdJobs[0].notificationPolicy).toEqual(rule.notificationPolicy);
    expect(result.updatedRules[0].nextPlannedAt).toBe(new Date(2026, 2, 12, 9, 0, 0, 0).toISOString());
  });
});
