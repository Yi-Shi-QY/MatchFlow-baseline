import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationDraft, AutomationJob } from '@/src/services/automation/types';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';

const mocks = vi.hoisted(() => ({
  activateAutomationDraft: vi.fn(),
  deleteAutomationDraft: vi.fn(),
  getAutomationDraft: vi.fn(),
  saveAutomationDraft: vi.fn(),
  saveAutomationDrafts: vi.fn(),
  ensureExecutionTicketForDraft: vi.fn(),
  patchExecutionTicket: vi.fn(),
  applyClarificationAnswer: vi.fn(),
  getNextClarificationQuestion: vi.fn(),
  createManagerSessionStore: vi.fn(),
  projectManagerSessionProjectionToLegacySnapshot: vi.fn(),
  getOrCreateMainSession: vi.fn(),
  loadSessionProjection: vi.fn(),
  kickAutomationRuntime: vi.fn(),
  resolveImmediateAnalysisNavigation: vi.fn(),
  appendMessage: vi.fn(),
}));

vi.mock('@/src/services/automation/activation', () => ({
  activateAutomationDraft: mocks.activateAutomationDraft,
}));

vi.mock('@/src/services/automation/draftStore', () => ({
  deleteAutomationDraft: mocks.deleteAutomationDraft,
  getAutomationDraft: mocks.getAutomationDraft,
  saveAutomationDraft: mocks.saveAutomationDraft,
  saveAutomationDrafts: mocks.saveAutomationDrafts,
}));

vi.mock('@/src/services/manager-workspace/executionTicketStore', () => ({
  ensureExecutionTicketForDraft: mocks.ensureExecutionTicketForDraft,
  patchExecutionTicket: mocks.patchExecutionTicket,
}));

vi.mock('@/src/services/automation/clarification', () => ({
  applyClarificationAnswer: mocks.applyClarificationAnswer,
  getNextClarificationQuestion: mocks.getNextClarificationQuestion,
}));

vi.mock('@/src/services/manager-gateway/sessionStore', () => ({
  createManagerSessionStore: mocks.createManagerSessionStore,
}));

vi.mock('@/src/services/manager-gateway/legacyCompat', () => ({
  projectManagerSessionProjectionToLegacySnapshot:
    mocks.projectManagerSessionProjectionToLegacySnapshot,
}));

vi.mock('@/src/services/manager-gateway/service', () => ({
  getManagerGateway: () => ({
    getOrCreateMainSession: mocks.getOrCreateMainSession,
    loadSessionProjection: mocks.loadSessionProjection,
  }),
}));

vi.mock('@/src/services/automation/runtimeCoordinator', () => ({
  kickAutomationRuntime: mocks.kickAutomationRuntime,
}));

vi.mock('@/src/services/automation/commandCenter', () => ({
  resolveImmediateAnalysisNavigation: mocks.resolveImmediateAnalysisNavigation,
}));

function createDraft(overrides: Partial<AutomationDraft> = {}): AutomationDraft {
  return {
    id: 'draft_run_now',
    sourceText: 'Analyze Arsenal vs Manchester City now',
    title: 'Analyze Arsenal vs Manchester City',
    status: 'ready',
    intentType: 'one_time',
    activationMode: 'run_now',
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    schedule: {
      type: 'one_time',
      runAt: '2026-03-14T10:00:00.000Z',
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
    analysisProfile: undefined,
    clarificationState: {
      roundsUsed: 0,
    },
    rejectionReason: undefined,
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

function createJob(overrides: Partial<AutomationJob> = {}): AutomationJob {
  return {
    id: 'job_formal_1',
    title: 'Analyze Arsenal vs Manchester City',
    sourceDraftId: 'draft_run_now',
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
    scheduledFor: '2026-03-14T10:00:00.000Z',
    state: 'pending',
    retryCount: 0,
    maxRetries: 1,
    retryAfter: null,
    recoveryWindowEndsAt: '2026-03-14T10:30:00.000Z',
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

function createProjection(): ManagerSessionProjection {
  return {
    session: {
      id: 'session_main',
      sessionKey: 'manager:main',
      title: 'Football',
      status: 'active',
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
      activeWorkflowType: null,
      activeWorkflowStateData: null,
      latestSummaryId: null,
      latestMessageAt: 200,
      createdAt: 100,
      updatedAt: 200,
    },
    runtimeDomainId: 'football',
    runtimeDomainVersion: '1.0.0',
    feed: [],
    activeRun: null,
    latestRun: null,
    activeWorkflow: null,
  };
}

describe('submitManagerDraftActivationProjectionResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createManagerSessionStore.mockReturnValue({
      appendMessage: mocks.appendMessage,
    });
    mocks.projectManagerSessionProjectionToLegacySnapshot.mockReturnValue({
      messages: [],
      pendingTask: null,
    });
    mocks.getOrCreateMainSession.mockResolvedValue(createProjection());
    mocks.loadSessionProjection.mockResolvedValue(createProjection());
    mocks.ensureExecutionTicketForDraft.mockResolvedValue({
      id: 'ticket_1',
    });
    mocks.patchExecutionTicket.mockResolvedValue(null);
    mocks.deleteAutomationDraft.mockResolvedValue(undefined);
    mocks.appendMessage.mockResolvedValue({
      id: 'message_1',
      sessionId: 'session_main',
      ordinal: 1,
      role: 'assistant',
      blockType: 'assistant_text',
      text: 'Started the formal task.',
      payloadData: null,
      createdAt: 300,
    });
    mocks.resolveImmediateAnalysisNavigation.mockResolvedValue({
      status: 'ready',
      navigation: {
        route: '/subject/football/match_1',
      },
    });
  });

  it('activates run-now drafts as formal jobs instead of returning navigation', async () => {
    const draft = createDraft();
    const job = createJob();
    mocks.getAutomationDraft.mockResolvedValue(draft);
    mocks.activateAutomationDraft.mockResolvedValue({
      kind: 'job',
      job,
    });

    const { submitManagerDraftActivationProjectionResult } = await import(
      '@/src/services/manager/runtime'
    );
    const result = await submitManagerDraftActivationProjectionResult({
      draftId: draft.id,
      language: 'en',
      session: {
        domainId: 'football',
        title: 'Football',
      },
    });

    expect(mocks.activateAutomationDraft).toHaveBeenCalledWith(draft);
    expect(mocks.resolveImmediateAnalysisNavigation).not.toHaveBeenCalled();
    expect(mocks.patchExecutionTicket).toHaveBeenCalledWith({
      ticketId: 'ticket_1',
      patch: {
        status: 'confirmed',
        jobId: job.id,
      },
    });
    expect(mocks.kickAutomationRuntime).toHaveBeenCalledWith('draft_activated');
    expect(mocks.deleteAutomationDraft).toHaveBeenCalledWith(draft.id);
    expect(mocks.appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_main',
        role: 'assistant',
        blockType: 'assistant_text',
        text: 'The manager confirmed "Analyze Arsenal vs Manchester City" and started the formal task.',
      }),
    );
    expect(result.shouldRefreshTaskState).toBe(true);
    expect(result.navigation).toBeUndefined();
  });
});
