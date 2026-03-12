import { describe, expect, it } from 'vitest';
import {
  buildAutomationNotificationRoute,
  resolveAutomationRunNotificationRoute,
} from '@/src/services/automation/notifications';
import type { AutomationJob, AutomationRun } from '@/src/services/automation/types';

function createJob(overrides: Partial<AutomationJob> = {}): AutomationJob {
  const now = Date.now();
  return {
    id: 'job-1',
    title: 'Analyze Arsenal vs Manchester City',
    sourceDraftId: 'draft-1',
    sourceRuleId: undefined,
    domainId: 'football',
    domainPackVersion: undefined,
    templateId: undefined,
    triggerType: 'one_time',
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'm1',
      subjectLabel: 'Arsenal vs Manchester City',
    },
    targetSnapshot: undefined,
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: false,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    scheduledFor: '2026-03-11T12:00:00.000Z',
    state: 'pending',
    retryCount: 0,
    maxRetries: 2,
    retryAfter: null,
    recoveryWindowEndsAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  const now = Date.now();
  return {
    id: 'run-1',
    jobId: 'job-1',
    title: 'Analyze Arsenal vs Manchester City',
    state: 'completed',
    domainId: 'football',
    startedAt: now,
    endedAt: now + 1_000,
    resultHistoryId: 'football::m1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('automation notifications', () => {
  it('builds focused automation hub routes from entity ids', () => {
    expect(
      buildAutomationNotificationRoute({
        draftId: 'draft-1',
        jobId: 'job-2',
        runId: 'run-3',
      }),
    ).toBe('/automation?draftId=draft-1&jobId=job-2&runId=run-3');
  });

  it('deep-links completed single-subject runs to the result subject route', () => {
    const route = resolveAutomationRunNotificationRoute(createJob(), createRun());

    expect(route).toBe('/subject/football/m1');
  });

  it('falls back to the automation hub for multi-target completed runs', () => {
    const route = resolveAutomationRunNotificationRoute(
      createJob({
        targetSelector: {
          mode: 'league_query',
          leagueKey: 'premier_league',
          leagueLabel: 'Premier League',
        },
        targetSnapshot: [
          { domainId: 'football', subjectId: 'm1', subjectType: 'match', title: 'm1' },
          { domainId: 'football', subjectId: 'm2', subjectType: 'match', title: 'm2' },
        ],
      }),
      createRun(),
    );

    expect(route).toBe('/automation?jobId=job-1&runId=run-1');
  });

  it('falls back to the automation hub for failed runs', () => {
    const route = resolveAutomationRunNotificationRoute(
      createJob(),
      createRun({
        state: 'failed',
      }),
    );

    expect(route).toBe('/automation?jobId=job-1&runId=run-1');
  });
});
