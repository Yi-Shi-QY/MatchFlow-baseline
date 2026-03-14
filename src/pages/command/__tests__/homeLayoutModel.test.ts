import { describe, expect, it } from 'vitest';
import type { AutomationDraft, AutomationJob, AutomationRun } from '@/src/services/automation';
import type { ManagerSessionProjection, ManagerRunRecord } from '@/src/services/manager-gateway/types';
import { buildManagerWorkspaceProjection } from '@/src/services/manager-workspace/projection';
import type { ExecutionTicket } from '@/src/services/manager-workspace/executionTicketTypes';
import { deriveCommandCenterHomeLayout } from '@/src/pages/command/homeLayoutModel';

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

function createRun(overrides: Partial<ManagerRunRecord> = {}): ManagerRunRecord {
  return {
    id: 'manager_run_1',
    sessionId: 'session_main',
    inputMessageId: 'message_1',
    status: 'running',
    triggerType: 'user',
    plannerMode: 'workflow',
    intentType: 'analysis',
    toolPath: 'workflow:football_task_intake',
    errorCode: null,
    errorMessage: null,
    stateData: null,
    startedAt: 1710000000000,
    finishedAt: null,
    createdAt: 1710000000000,
    updatedAt: 1710000005000,
    ...overrides,
  };
}

function createAutomationJob(overrides: Partial<AutomationJob> = {}): AutomationJob {
  return {
    id: 'job_1',
    title: 'Analyze Arsenal vs Manchester City',
    sourceDraftId: 'draft_1',
    sourceRuleId: undefined,
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    triggerType: 'one_time',
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'match_1',
      subjectLabel: 'Arsenal vs Manchester City',
    },
    targetSnapshot: undefined,
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    analysisProfile: undefined,
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

function createAutomationRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 'automation_run_1',
    jobId: 'job_1',
    title: 'Analyze Arsenal vs Manchester City',
    state: 'completed',
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    startedAt: 1710000000000,
    endedAt: 1710000005000,
    provider: 'openai',
    model: 'gpt-5',
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    tokenSource: 'provider',
    resultHistoryId: 'football::match_1',
    errorCode: undefined,
    errorMessage: undefined,
    createdAt: 1710000000000,
    updatedAt: 1710000005000,
    ...overrides,
  };
}

function createExecutionTicket(overrides: Partial<ExecutionTicket> = {}): ExecutionTicket {
  return {
    id: 'execution_ticket_1',
    source: 'command_center',
    executionMode: 'run_now',
    status: 'pending_confirmation',
    title: 'Analyze Arsenal vs Manchester City',
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
      title: 'Analyze Arsenal vs Manchester City',
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
    createdAt: 150,
    updatedAt: 250,
    ...overrides,
  };
}

function createProjection(overrides: Partial<ManagerSessionProjection> = {}): ManagerSessionProjection {
  return {
    session: {
      id: 'session_main',
      sessionKey: 'manager:main',
      title: 'Manager',
      status: 'active',
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
      activeWorkflowType: null,
      activeWorkflowStateData: null,
      latestSummaryId: null,
      latestMessageAt: 1710000005000,
      createdAt: 1710000000000,
      updatedAt: 1710000005000,
    },
    runtimeDomainId: 'football',
    runtimeDomainVersion: '1.0.0',
    activeRun: null,
    latestRun: null,
    activeWorkflow: null,
    feed: [
      {
        id: 'msg_user_1',
        role: 'user',
        blockType: 'user_text',
        text: 'Analyze Arsenal vs Manchester City',
        payloadData: null,
        createdAt: 1710000000000,
      },
      {
        id: 'msg_assistant_1',
        role: 'assistant',
        blockType: 'assistant_text',
        text: 'Here is the latest completed summary.',
        payloadData: null,
        createdAt: 1710000004000,
      },
    ],
    ...overrides,
  };
}

function createWorkspaceProjection(input: {
  projection?: Partial<ManagerSessionProjection>;
  drafts?: AutomationDraft[];
  jobs?: AutomationJob[];
  runs?: AutomationRun[];
  executionTickets?: ExecutionTicket[];
}) {
  return buildManagerWorkspaceProjection({
    managerProjection: createProjection(input.projection),
    drafts: input.drafts || [],
    jobs: input.jobs || [],
    runs: input.runs || [],
    executionTickets: input.executionTickets || [],
    memoryCandidates: [],
  });
}

describe('command center home layout model', () => {
  it('prioritizes continue cards and caps them at three items', () => {
    const workspaceProjection = createWorkspaceProjection({
      projection: {
        activeRun: createRun(),
        latestRun: createRun({
          id: 'manager_run_error',
          status: 'failed',
          errorCode: 'provider_timeout',
          errorMessage: 'Provider timeout.',
          finishedAt: 1710000004000,
        }),
        feed: [
          ...createProjection().feed,
          {
            id: 'msg_error_1',
            role: 'assistant',
            blockType: 'error_notice',
            text: 'Provider timeout.',
            payloadData: null,
            createdAt: 1710000004500,
          },
        ],
      },
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
      jobs: [
        createAutomationJob({
          id: 'job_running',
          state: 'running',
        }),
      ],
      runs: [
        createAutomationRun({
          id: 'run_running',
          state: 'running',
          endedAt: undefined,
          updatedAt: 1710000004500,
        }),
      ],
      executionTickets: [
        createExecutionTicket({
          id: 'execution_ticket_ready',
          draftId: 'draft_ready',
          updatedAt: 1710000004600,
        }),
      ],
    });

    const layout = deriveCommandCenterHomeLayout({
      workspaceProjection,
      language: 'zh',
    });

    expect(layout.mode).toBe('continue_first');
    expect(layout.continueCards).toHaveLength(3);
    expect(layout.continueCards.map((item) => item.kind)).toEqual([
      'approval',
      'clarification',
      'exception',
    ]);
    expect(layout.continueCards[0].id).toBe('approval:execution_ticket_ready');
    expect(layout.continueCards[0].kind).toBe('approval');
    expect(layout.runningCount).toBe(2);
    expect(layout.suggestionChips.every((chip) => chip.autoSubmit === false)).toBe(true);
  });

  it('falls back to draft identity before a formal ticket exists', () => {
    const layout = deriveCommandCenterHomeLayout({
      workspaceProjection: createWorkspaceProjection({
        drafts: [
          createDraft({
            id: 'draft_ready',
            status: 'ready',
          }),
        ],
      }),
      language: 'en',
    });

    expect(layout.continueCards[0]).toMatchObject({
      id: 'approval:draft_ready',
      kind: 'approval',
    });
  });

  it('falls back to a last-summary strip when the previous flow is closed', () => {
    const layout = deriveCommandCenterHomeLayout({
      workspaceProjection: createWorkspaceProjection({
        projection: {
          latestRun: createRun({
            status: 'completed',
            finishedAt: 1710000005000,
          }),
        },
      }),
      language: 'en',
    });

    expect(layout.mode).toBe('new_input_first');
    expect(layout.continueCards).toEqual([]);
    expect(layout.lastSummaryCard).toMatchObject({
      title: 'Last completed flow',
      summary: 'Here is the latest completed summary.',
    });
    expect(layout.suggestionChips).toHaveLength(3);
    expect(layout.suggestionChips[0].autoSubmit).toBe(false);
  });
});
