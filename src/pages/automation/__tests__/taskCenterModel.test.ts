import { describe, expect, it } from 'vitest';
import type {
  AutomationDraft,
  AutomationJob,
  AutomationRule,
  AutomationRun,
} from '@/src/services/automation';
import { deriveCommandCenterHomeLayout } from '@/src/pages/command/homeLayoutModel';
import { deriveTaskCenterModel } from '@/src/pages/automation/taskCenterModel';
import type { ExecutionTicket } from '@/src/services/manager-workspace/executionTicketTypes';
import { buildManagerWorkspaceProjection } from '@/src/services/manager-workspace/projection';

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

function createExecutionTicket(overrides: Partial<ExecutionTicket> = {}): ExecutionTicket {
  return {
    id: 'execution_ticket_1',
    source: 'task_center',
    executionMode: 'run_now',
    status: 'pending_confirmation',
    title: 'Tonight Arsenal vs Manchester City',
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    draftId: 'draft_1',
    jobId: undefined,
    runId: undefined,
    target: {
      domainId: 'football',
      subjectId: 'match_1',
      targetLabel: 'Arsenal vs Manchester City',
      scheduledFor: '2026-03-13T12:00:00.000Z',
    },
    draftSnapshot: {
      sourceText: 'Analyze Arsenal vs Manchester City',
      title: 'Tonight Arsenal vs Manchester City',
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
    },
    createdAt: 100,
    updatedAt: 300,
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
      executionTickets: [
        createExecutionTicket({
          id: 'execution_ticket_ready',
          draftId: 'draft_ready',
        }),
      ],
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
    expect(model.waitingItems[0]).toMatchObject({
      id: 'approval:execution_ticket_ready',
      target: {
        type: 'draft',
        id: 'draft_ready',
      },
    });
    expect(model.runningItems[0].primaryAction.label).toBe('查看进展');
    expect(model.scheduledItems).toHaveLength(2);
    expect(model.completedItems[0].primaryAction.label).toBe('查看结果');
  });

  it('uses the same approval identity as the command center and falls back to draft id', () => {
    const draft = createDraft({
      id: 'draft_ready',
      status: 'ready',
    });
    const ticket = createExecutionTicket({
      id: 'execution_ticket_ready',
      draftId: 'draft_ready',
    });

    const taskCenterModel = deriveTaskCenterModel({
      drafts: [draft],
      rules: [],
      jobs: [],
      runs: [],
      language: 'en',
      executionTickets: [ticket],
    });
    const homeLayout = deriveCommandCenterHomeLayout({
      workspaceProjection: buildManagerWorkspaceProjection({
        managerProjection: null,
        drafts: [draft],
        jobs: [],
        runs: [],
        executionTickets: [ticket],
        memoryCandidates: [],
      }),
      language: 'en',
    });
    const fallbackModel = deriveTaskCenterModel({
      drafts: [draft],
      rules: [],
      jobs: [],
      runs: [],
      language: 'en',
      executionTickets: [],
    });

    expect(taskCenterModel.waitingItems[0]?.id).toBe(homeLayout.continueCards[0]?.id);
    expect(taskCenterModel.waitingItems[0]?.id).toBe('approval:execution_ticket_ready');
    expect(fallbackModel.waitingItems[0]?.id).toBe('approval:draft_ready');
  });
});
