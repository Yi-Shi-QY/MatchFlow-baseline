import { describe, expect, it } from 'vitest';
import type {
  AutomationDraft,
  AutomationJob,
  AutomationRule,
  AutomationRun,
} from '@/src/services/automation';
import { deriveTaskCenterModel } from '@/src/pages/automation/taskCenterModel';

function createDraft(overrides: Partial<AutomationDraft>): AutomationDraft {
  return {
    id: 'draft_1',
    domainId: 'football',
    sourceText: 'Analyze Arsenal vs Manchester City',
    title: 'Analyze Arsenal vs Manchester City',
    status: 'ready',
    intentType: 'one_time',
    activationMode: 'run_now',
    schedule: {
      type: 'one_time',
      runAt: '2026-03-13T12:00:00.000Z',
      timezone: 'Asia/Shanghai',
    },
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'match_1',
      subjectLabel: 'Arsenal vs Manchester City',
    },
    executionPolicy: {
      targetExpansion: 'single',
      recoveryWindowMinutes: 30,
      maxRetries: 1,
    },
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    clarificationState: {
      roundsUsed: 0,
    },
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

function createRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule_1',
    domainId: 'football',
    title: 'Daily Premier League scan',
    enabled: true,
    schedule: {
      type: 'daily',
      time: '09:00',
      timezone: 'Asia/Shanghai',
    },
    targetSelector: {
      mode: 'league_query',
      leagueKey: 'epl',
      leagueLabel: 'Premier League',
    },
    executionPolicy: {
      targetExpansion: 'all_matches',
      recoveryWindowMinutes: 60,
      maxRetries: 2,
    },
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    nextPlannedAt: '2026-03-14T01:00:00.000Z',
    timezone: 'Asia/Shanghai',
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

function createJob(overrides: Partial<AutomationJob> = {}): AutomationJob {
  return {
    id: 'job_1',
    domainId: 'football',
    title: 'Tonight Arsenal vs Manchester City',
    triggerType: 'one_time',
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'match_1',
      subjectLabel: 'Arsenal vs Manchester City',
    },
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    scheduledFor: '2026-03-13T12:00:00.000Z',
    state: 'pending',
    retryCount: 0,
    maxRetries: 1,
    retryAfter: null,
    recoveryWindowEndsAt: null,
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

function createRun(overrides: Partial<AutomationRun>): AutomationRun {
  return {
    id: 'run_1',
    domainId: 'football',
    jobId: 'job_1',
    title: 'Tonight Arsenal vs Manchester City',
    state: 'running',
    startedAt: 1710000000000,
    createdAt: 1710000000000,
    updatedAt: 1710000005000,
    ...overrides,
  };
}

describe('task center model', () => {
  it('classifies waiting, running, scheduled, and completed items in the frozen order', () => {
    const model = deriveTaskCenterModel({
      drafts: [
        createDraft({
          id: 'draft_ready',
          status: 'ready',
        }),
        createDraft({
          id: 'draft_clarify',
          status: 'needs_clarification',
          targetSelector: undefined,
        }),
      ],
      rules: [createRule()],
      jobs: [createJob()],
      runs: [
        createRun({
          id: 'run_running',
          state: 'running',
        }),
        createRun({
          id: 'run_failed',
          state: 'failed',
          errorMessage: 'Provider timeout.',
        }),
        createRun({
          id: 'run_completed',
          state: 'completed',
          endedAt: 1710000008000,
        }),
      ],
      language: 'zh',
    });

    expect(model.summaryMetrics.map((item) => item.id)).toEqual([
      'waiting',
      'running',
      'scheduled',
      'completed',
    ]);
    expect(model.waitingItems.map((item) => item.kind)).toEqual([
      'approval',
      'clarification',
      'exception',
    ]);
    expect(model.runningItems[0].primaryAction.label).toBe('查看进展');
    expect(model.scheduledItems).toHaveLength(2);
    expect(model.completedItems[0].primaryAction.label).toBe('查看结果');
  });
});
