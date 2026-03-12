import { describe, expect, it } from 'vitest';
import { deriveNativeAutomationScheduleEntries } from '@/src/services/automation/nativeScheduler';
import type { AutomationJob, AutomationRule } from '@/src/services/automation/types';

function createJob(overrides: Partial<AutomationJob>): AutomationJob {
  const now = Date.now();
  return {
    id: 'job-1',
    title: 'One-time analysis',
    sourceDraftId: 'draft-1',
    sourceRuleId: undefined,
    domainId: 'football',
    domainPackVersion: undefined,
    templateId: undefined,
    triggerType: 'one_time',
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'match-1',
      subjectLabel: 'Match 1',
    },
    targetSnapshot: undefined,
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: false,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    scheduledFor: new Date(now + 60_000).toISOString(),
    state: 'pending',
    retryCount: 0,
    maxRetries: 2,
    retryAfter: null,
    recoveryWindowEndsAt: new Date(now + 90_000).toISOString(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createRule(overrides: Partial<AutomationRule>): AutomationRule {
  const now = Date.now();
  return {
    id: 'rule-1',
    title: 'Daily scan',
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
    nextPlannedAt: new Date(now + 30_000).toISOString(),
    timezone: 'Asia/Shanghai',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('deriveNativeAutomationScheduleEntries', () => {
  it('emits job_due, job_retry, and rule_expand entries (sorted by triggerAt)', () => {
    const nowMs = 1_000_000;
    const dueJob = createJob({
      id: 'job-due',
      state: 'pending',
      scheduledFor: new Date(nowMs + 20_000).toISOString(),
    });
    const retryJob = createJob({
      id: 'job-retry',
      state: 'failed_retryable',
      retryAfter: new Date(nowMs + 10_000).toISOString(),
    });
    const rule = createRule({
      id: 'rule-next',
      enabled: true,
      nextPlannedAt: new Date(nowMs + 15_000).toISOString(),
    });

    const entries = deriveNativeAutomationScheduleEntries({
      jobs: [dueJob, retryJob],
      rules: [rule],
      nowMs,
    });

    expect(entries.map((entry) => entry.id)).toEqual([
      'job_retry:job-retry',
      'rule_expand:rule-next',
      'job_due:job-due',
    ]);
    expect(entries[0].kind).toBe('job_retry');
    expect(entries[1].kind).toBe('rule_expand');
    expect(entries[2].kind).toBe('job_due');
  });

  it('clamps triggers that are already in the past', () => {
    const nowMs = 1_000_000;
    const job = createJob({
      id: 'job-past',
      state: 'pending',
      scheduledFor: new Date(nowMs - 10_000).toISOString(),
    });
    const entries = deriveNativeAutomationScheduleEntries({
      jobs: [job],
      rules: [],
      nowMs,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('job_due:job-past');
    expect(entries[0].triggerAtEpochMs).toBeGreaterThanOrEqual(nowMs + 1_000);
  });

  it('skips disabled rules or rules without nextPlannedAt', () => {
    const nowMs = 1_000_000;
    const entries = deriveNativeAutomationScheduleEntries({
      jobs: [],
      rules: [
        createRule({ id: 'rule-disabled', enabled: false }),
        createRule({ id: 'rule-missing', nextPlannedAt: null }),
      ],
      nowMs,
    });

    expect(entries).toHaveLength(0);
  });
});

