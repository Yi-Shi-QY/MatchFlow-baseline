import { describe, expect, it } from 'vitest';
import { PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE } from '@/src/domains/runtime/projectOps/workflowType';
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
      sessionKind: 'domain_main',
      title: 'Manager',
      status: 'active',
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
      activeWorkflowType: null,
      activeWorkflowStateData: null,
      compositeWorkflowStateData: null,
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
    compositeWorkflow: null,
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
      language: 'en',
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

  it('surfaces active workflow clarification before falling back to the last summary strip', () => {
    const layout = deriveCommandCenterHomeLayout({
      workspaceProjection: createWorkspaceProjection({
        projection: {
          session: {
            ...createProjection().session,
            domainId: 'project_ops',
          },
          runtimeDomainId: 'project_ops',
          latestRun: createRun({
            status: 'completed',
            finishedAt: 1710000005000,
          }),
          activeWorkflow: {
            workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
            stateData: {
              schemaVersion: 'manager_intake_v1',
              workflowId: 'project_ops_intake_1',
              workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
              domainId: 'project_ops',
              sourceText: 'Analyze Q2 Mobile Launch now',
              composerMode: 'smart',
              drafts: [],
              slotValues: {
                target_subject: {
                  subjectId: 'project_mobile_launch',
                  label: 'Q2 Mobile Launch',
                  subjectType: 'project',
                },
              },
              recognizedSlotIds: ['target_subject'],
              missingSlotIds: ['focus_dimensions'],
              activeStepId: 'focus_dimensions',
              completed: false,
              createdAt: 1710000004500,
              updatedAt: 1710000004500,
            },
            updatedAt: 1710000004500,
          },
        },
      }),
      language: 'en',
      domainId: 'project_ops',
    });

    expect(layout.mode).toBe('continue_first');
    expect(layout.lastSummaryCard).toBeNull();
    expect(layout.statusTone).toBe('warning');
    expect(layout.pendingCount).toBe(1);
    expect(layout.continueCards).toHaveLength(1);
    expect(layout.continueCards[0]).toMatchObject({
      id: 'workflow:project_ops_intake_1',
      kind: 'clarification',
      title: 'Choose focus areas',
      primaryActionLabel: 'Continue in chat',
      action: {
        type: 'focus_conversation',
      },
    });
    expect(layout.continueCards[0].description).toContain('Q2 Mobile Launch');
    expect(layout.continueCards[0].title).not.toContain('vs');
  });

  it('uses the active supervisor composite item as the top-strip source of truth and exposes domain chips on continue cards', () => {
    const layout = deriveCommandCenterHomeLayout({
      workspaceProjection: createWorkspaceProjection({
        projection: {
          session: {
            ...createProjection().session,
            sessionKey: 'manager:main:supervisor',
            sessionKind: 'supervisor',
          },
          latestRun: createRun({
            status: 'completed',
            finishedAt: 1710000005000,
          }),
          feed: [
            {
              id: 'msg_completed_1',
              role: 'assistant',
              blockType: 'assistant_text',
              text: 'Football analysis configured.',
              payloadData: null,
              createdAt: 1710000003000,
            },
          ],
          compositeWorkflow: {
            schemaVersion: 'manager_composite_v1',
            workflowId: 'manager_composite_1',
            workflowType: 'manager_composite',
            sourceText: 'Analyze football and project ops',
            status: 'active',
            activeItemId: 'item_project_ops',
            createdAt: 1710000000000,
            updatedAt: 1710000005000,
            items: [
              {
                itemId: 'item_football',
                title: 'Real Madrid vs Barcelona',
                domainId: 'football',
                sourceText: 'Analyze Real Madrid vs Barcelona',
                status: 'completed',
                summary: 'Football analysis configured.',
              },
              {
                itemId: 'item_project_ops',
                title: 'Q2 mobile launch blockers',
                domainId: 'project_ops',
                sourceText: 'Review Q2 mobile launch blockers',
                status: 'active',
                childSessionId: 'child_session_2',
                childWorkflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
                childWorkflowStateData: {
                  schemaVersion: 'manager_intake_v1',
                  workflowId: 'project_ops_intake_1',
                  workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
                  domainId: 'project_ops',
                  sourceText: 'Review Q2 mobile launch blockers',
                  composerMode: 'smart',
                  drafts: [],
                  slotValues: {},
                  recognizedSlotIds: [],
                  missingSlotIds: ['focus_dimensions'],
                  activeStepId: 'focus_dimensions',
                  completed: false,
                  createdAt: 1710000004000,
                  updatedAt: 1710000004000,
                },
                pendingLabel: 'Choose focus areas',
                summary: 'Project ops intake is waiting for focus areas.',
              },
            ],
          },
        },
      }),
      language: 'en',
      domainId: 'football',
    });

    expect(layout.mode).toBe('continue_first');
    expect(layout.statusLabel).toBe('Q2 mobile launch blockers');
    expect(layout.statusTone).toBe('warning');
    expect(layout.lastSummaryCard).toBeNull();
    expect(layout.continueCards[0]).toMatchObject({
      id: 'composite:item_project_ops',
      kind: 'clarification',
      title: 'Q2 mobile launch blockers',
      description: 'Project ops intake is waiting for focus areas.',
      primaryActionLabel: 'Continue in chat',
      chips: ['Project Ops', 'Choose focus areas'],
    });
  });

  it('uses the latest composite child summary for the summary strip after a supervisor flow is complete', () => {
    const layout = deriveCommandCenterHomeLayout({
      workspaceProjection: createWorkspaceProjection({
        projection: {
          session: {
            ...createProjection().session,
            sessionKey: 'manager:main:supervisor',
            sessionKind: 'supervisor',
          },
          feed: [],
          compositeWorkflow: {
            schemaVersion: 'manager_composite_v1',
            workflowId: 'manager_composite_done',
            workflowType: 'manager_composite',
            sourceText: 'Analyze football and project ops',
            status: 'completed',
            activeItemId: null,
            createdAt: 1710000000000,
            updatedAt: 1710000005000,
            items: [
              {
                itemId: 'item_football',
                title: 'Real Madrid vs Barcelona',
                domainId: 'football',
                sourceText: 'Analyze Real Madrid vs Barcelona',
                status: 'completed',
                summary: 'Football analysis configured.',
              },
              {
                itemId: 'item_project_ops',
                title: 'Q2 mobile launch blockers',
                domainId: 'project_ops',
                sourceText: 'Review Q2 mobile launch blockers',
                status: 'completed',
                summary: 'Project ops focus areas confirmed.',
              },
            ],
          },
        },
      }),
      language: 'en',
      domainId: 'football',
    });

    expect(layout.mode).toBe('new_input_first');
    expect(layout.continueCards).toEqual([]);
    expect(layout.lastSummaryCard).toMatchObject({
      title: 'Last completed flow',
      summary: 'Project ops focus areas confirmed.',
    });
  });
});
