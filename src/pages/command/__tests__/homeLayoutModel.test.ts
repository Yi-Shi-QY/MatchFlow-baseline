import { describe, expect, it } from 'vitest';
import type { AutomationDraft } from '@/src/services/automation';
import type { ManagerSessionProjection, ManagerRunRecord } from '@/src/services/manager-gateway/types';
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

describe('command center home layout model', () => {
  it('prioritizes continue cards and caps them at three items', () => {
    const projection = createProjection({
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
    });
    const drafts = [
      createDraft({
        id: 'draft_ready',
        status: 'ready',
      }),
      createDraft({
        id: 'draft_clarify',
        status: 'needs_clarification',
        targetSelector: undefined,
      }),
    ];

    const layout = deriveCommandCenterHomeLayout({
      projection,
      drafts,
      language: 'zh',
    });

    expect(layout.mode).toBe('continue_first');
    expect(layout.continueCards).toHaveLength(3);
    expect(layout.continueCards.map((item) => item.kind)).toEqual([
      'approval',
      'clarification',
      'exception',
    ]);
    expect(layout.continueCards[0].kind).toBe('approval');
    expect(layout.suggestionChips.every((chip) => chip.autoSubmit === false)).toBe(true);
  });

  it('falls back to a last-summary strip when the previous flow is closed', () => {
    const layout = deriveCommandCenterHomeLayout({
      projection: createProjection({
        latestRun: createRun({
          status: 'completed',
          finishedAt: 1710000005000,
        }),
      }),
      drafts: [],
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
