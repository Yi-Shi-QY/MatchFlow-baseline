import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import {
  cancelGatewayBackedManagerRun,
  loadGatewayBackedManagerMainProjection,
  submitGatewayBackedManagerTurn,
  submitGatewayBackedManagerClarificationAnswer,
  submitGatewayBackedManagerDraftActivation,
  submitGatewayBackedManagerDraftDeletion,
  syncGatewayBackedManagerConversationWithDrafts,
} from '@/src/services/manager-gateway/compatActions';

interface ProjectionActionResult {
  projection: ManagerSessionProjection;
  feedbackMessage?: string;
  shouldRefreshTaskState: boolean;
  navigation?: {
    route: string;
    state?: Record<string, unknown>;
  };
}

const mocks = vi.hoisted(() => ({
  submitManagerClarificationAnswerProjectionResult: vi.fn(),
  submitManagerDraftActivationProjectionResult: vi.fn(),
  submitManagerDraftDeletionProjectionResult: vi.fn(),
  submitManagerTurnProjectionResult: vi.fn(),
  syncManagerConversationWithDraftsProjectionResult: vi.fn(),
  getOrCreateMainSession: vi.fn(),
  loadSessionProjection: vi.fn(),
  cancelSessionRun: vi.fn(),
}));

vi.mock('@/src/services/manager/runtime', () => ({
  submitManagerClarificationAnswerProjectionResult:
    mocks.submitManagerClarificationAnswerProjectionResult,
  submitManagerDraftActivationProjectionResult:
    mocks.submitManagerDraftActivationProjectionResult,
  submitManagerDraftDeletionProjectionResult: mocks.submitManagerDraftDeletionProjectionResult,
  submitManagerTurnProjectionResult: mocks.submitManagerTurnProjectionResult,
  syncManagerConversationWithDraftsProjectionResult:
    mocks.syncManagerConversationWithDraftsProjectionResult,
}));

vi.mock('@/src/services/manager-gateway/service', () => ({
  getManagerGateway: () => ({
    getOrCreateMainSession: mocks.getOrCreateMainSession,
    loadSessionProjection: mocks.loadSessionProjection,
    cancelSessionRun: mocks.cancelSessionRun,
  }),
}));

function createProjection(overrides: Partial<ManagerSessionProjection> = {}): ManagerSessionProjection {
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
    ...overrides,
  };
}

function createActionResult(overrides: Partial<ProjectionActionResult> = {}): ProjectionActionResult {
  return {
    projection: createProjection(),
    shouldRefreshTaskState: false,
    ...overrides,
  };
}

describe('manager gateway compat actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateMainSession.mockResolvedValue(createProjection());
    mocks.loadSessionProjection.mockResolvedValue(createProjection());
  });

  it('loads the gateway-backed main projection through the compat helper', async () => {
    const projection = await loadGatewayBackedManagerMainProjection({
      domainId: 'football',
      title: 'Football',
    });

    expect(mocks.getOrCreateMainSession).toHaveBeenCalledWith({
      domainId: 'football',
      title: 'Football',
    });
    expect(projection.session.id).toBe('session_main');
  });

  it('passes through the projection-first turn result without reloading the main session', async () => {
    const actionResult = createActionResult({
      projection: createProjection({
        feed: [
          {
            id: 'msg_1',
            role: 'assistant',
            blockType: 'assistant_text',
            text: 'LLM handled.',
            payloadData: null,
            createdAt: 210,
          },
        ],
      }),
      feedbackMessage: 'LLM handled.',
      shouldRefreshTaskState: true,
    });
    mocks.submitManagerTurnProjectionResult.mockResolvedValue(actionResult);

    const result = await submitGatewayBackedManagerTurn({
      input: 'Analyze Arsenal vs Chelsea tonight',
      language: 'en',
      domainId: 'football',
      title: 'Football',
      allowHeuristicFallback: false,
    });

    expect(mocks.submitManagerTurnProjectionResult).toHaveBeenCalledWith({
      input: 'Analyze Arsenal vs Chelsea tonight',
      language: 'en',
      domainId: 'football',
      domainName: 'Football',
      allowHeuristicFallback: false,
    });
    expect(mocks.getOrCreateMainSession).not.toHaveBeenCalled();
    expect(result).toBe(actionResult);
  });

  it('passes through the projection-first draft sync result without rebuilding a session snapshot', async () => {
    const actionResult = createActionResult({
      projection: createProjection({
        feed: [
          {
            id: 'msg_bundle_1',
            role: 'assistant',
            blockType: 'draft_bundle',
            text: 'I kept the draft bundle in the conversation.',
            payloadData: JSON.stringify({ draftIds: ['draft_1', 'draft_2'] }),
            createdAt: 220,
          },
        ],
      }),
    });
    mocks.syncManagerConversationWithDraftsProjectionResult.mockResolvedValue(actionResult);

    const result = await syncGatewayBackedManagerConversationWithDrafts({
      language: 'en',
      draftIds: ['draft_1', 'draft_2'],
      domainId: 'football',
      title: 'Football',
    });

    expect(mocks.syncManagerConversationWithDraftsProjectionResult).toHaveBeenCalledWith({
      language: 'en',
      draftIds: ['draft_1', 'draft_2'],
      session: {
        domainId: 'football',
        title: 'Football',
      },
    });
    expect(mocks.getOrCreateMainSession).not.toHaveBeenCalled();
    expect(result).toBe(actionResult);
  });

  it('passes through the projection-first clarification result', async () => {
    const actionResult = createActionResult({
      feedbackMessage: 'Draft updated.',
      shouldRefreshTaskState: true,
    });
    mocks.submitManagerClarificationAnswerProjectionResult.mockResolvedValue(actionResult);

    const result = await submitGatewayBackedManagerClarificationAnswer({
      draftId: 'draft_1',
      answer: 'Use market data',
      language: 'en',
      domainId: 'football',
      title: 'Football',
    });

    expect(mocks.submitManagerClarificationAnswerProjectionResult).toHaveBeenCalledWith({
      draftId: 'draft_1',
      answer: 'Use market data',
      language: 'en',
      session: {
        domainId: 'football',
        title: 'Football',
      },
    });
    expect(mocks.getOrCreateMainSession).not.toHaveBeenCalled();
    expect(result).toBe(actionResult);
  });

  it('preserves navigation metadata from the projection-first activation result', async () => {
    const actionResult = createActionResult({
      shouldRefreshTaskState: true,
      navigation: {
        route: '/subject/football/match-1',
        state: {
          source: 'command-center',
        },
      },
    });
    mocks.submitManagerDraftActivationProjectionResult.mockResolvedValue(actionResult);

    const result = await submitGatewayBackedManagerDraftActivation({
      draftId: 'draft_2',
      language: 'en',
      domainId: 'football',
      title: 'Football',
    });

    expect(mocks.submitManagerDraftActivationProjectionResult).toHaveBeenCalledWith({
      draftId: 'draft_2',
      language: 'en',
      session: {
        domainId: 'football',
        title: 'Football',
      },
    });
    expect(mocks.getOrCreateMainSession).not.toHaveBeenCalled();
    expect(result).toBe(actionResult);
  });

  it('passes through the projection-first draft deletion result', async () => {
    const actionResult = createActionResult({
      feedbackMessage: 'Draft deleted.',
      shouldRefreshTaskState: true,
    });
    mocks.submitManagerDraftDeletionProjectionResult.mockResolvedValue(actionResult);

    const result = await submitGatewayBackedManagerDraftDeletion({
      draftId: 'draft_3',
      language: 'en',
      domainId: 'football',
      title: 'Football',
    });

    expect(mocks.submitManagerDraftDeletionProjectionResult).toHaveBeenCalledWith({
      draftId: 'draft_3',
      language: 'en',
      session: {
        domainId: 'football',
        title: 'Football',
      },
    });
    expect(mocks.getOrCreateMainSession).not.toHaveBeenCalled();
    expect(result).toBe(actionResult);
  });

  it('cancels the current gateway-backed run through the compat facade', async () => {
    mocks.cancelSessionRun.mockResolvedValue({
      projection: {
        ...createProjection(),
        latestRun: {
          id: 'run_1',
          sessionId: 'session_main',
          inputMessageId: 'message_1',
          status: 'cancelled',
          triggerType: 'user',
          plannerMode: null,
          intentType: null,
          toolPath: null,
          errorCode: 'cancelled_by_user',
          errorMessage: 'Cancelled before execution.',
          stateData: null,
          startedAt: null,
          finishedAt: 200,
          createdAt: 100,
          updatedAt: 200,
        },
      },
      outcome: 'cancelled',
      runId: 'run_1',
      feedbackMessage: 'Queued manager turn cancelled before execution.',
    });

    const result = await cancelGatewayBackedManagerRun({
      domainId: 'football',
      title: 'Football',
    });

    expect(mocks.getOrCreateMainSession).toHaveBeenCalledWith({
      domainId: 'football',
      title: 'Football',
    });
    expect(mocks.cancelSessionRun).toHaveBeenCalledWith('session_main', {
      mode: undefined,
    });
    expect(result).toMatchObject({
      outcome: 'cancelled',
      runId: 'run_1',
      feedbackMessage: 'Queued manager turn cancelled before execution.',
      shouldRefreshTaskState: false,
    });
  });

  it('surfaces running interrupt requests through the compat facade', async () => {
    mocks.cancelSessionRun.mockResolvedValue({
      projection: {
        ...createProjection(),
        activeRun: {
          id: 'run_2',
          sessionId: 'session_main',
          inputMessageId: 'message_2',
          status: 'running',
          triggerType: 'user',
          plannerMode: 'llm_assisted',
          intentType: 'analyze',
          toolPath: 'workflow:task_intake',
          errorCode: null,
          errorMessage: null,
          stateData: null,
          startedAt: 300,
          finishedAt: null,
          createdAt: 250,
          updatedAt: 320,
        },
        latestRun: {
          id: 'run_2',
          sessionId: 'session_main',
          inputMessageId: 'message_2',
          status: 'running',
          triggerType: 'user',
          plannerMode: 'llm_assisted',
          intentType: 'analyze',
          toolPath: 'workflow:task_intake',
          errorCode: null,
          errorMessage: null,
          stateData: null,
          startedAt: 300,
          finishedAt: null,
          createdAt: 250,
          updatedAt: 320,
        },
      },
      outcome: 'interrupt_requested',
      runId: 'run_2',
      feedbackMessage: 'Interrupt requested for the active manager run.',
    });

    const result = await cancelGatewayBackedManagerRun({
      sessionId: 'session_main',
      domainId: 'football',
      title: 'Football',
      mode: 'running',
    });

    expect(mocks.loadSessionProjection).toHaveBeenCalledWith('session_main');
    expect(mocks.cancelSessionRun).toHaveBeenCalledWith('session_main', {
      mode: 'running',
    });
    expect(result).toMatchObject({
      outcome: 'interrupt_requested',
      runId: 'run_2',
      feedbackMessage: 'Interrupt requested for the active manager run.',
      shouldRefreshTaskState: false,
    });
  });
});
