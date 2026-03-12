import { describe, expect, it, vi } from 'vitest';
import type {
  AnalysisIntent,
  DomainRuntimePack,
  RuntimeFeedBlockInput,
  RuntimeToolExecutionResult,
  SessionWorkflowStateSnapshot,
  WorkflowResumeResult,
} from '@/src/domains/runtime/types';
import { createManagerGateway } from '@/src/services/manager-gateway/gateway';
import type {
  ManagerGatewayLlmPlanner,
  ManagerGatewaySessionStore,
  ManagerMemoryRecord,
  ManagerMessageRecord,
  ManagerRunRecord,
  ManagerSessionRecord,
  ManagerSummaryRecord,
} from '@/src/services/manager-gateway/types';

function createMutableSessionStore(
  overrides: Partial<ManagerSessionRecord> = {},
): ManagerGatewaySessionStore & {
  getMessagesSnapshot(): ManagerMessageRecord[];
  getRunsSnapshot(): ManagerRunRecord[];
} {
  let session: ManagerSessionRecord = {
    id: 'session_main',
    sessionKey: 'manager:main',
    title: 'Main session',
    status: 'active',
    domainId: 'ops',
    runtimeDomainVersion: '1.0.0',
    activeWorkflowType: null,
    activeWorkflowStateData: null,
    latestSummaryId: null,
    latestMessageAt: 100,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
  const messages: ManagerMessageRecord[] = [];
  const runs: ManagerRunRecord[] = [];
  const summaries: ManagerSummaryRecord[] = [];
  const memories: ManagerMemoryRecord[] = [];

  return {
    async getOrCreateMainSession(input) {
      session = {
        ...session,
        domainId: input.domainId,
        runtimeDomainVersion: input.runtimeDomainVersion || session.runtimeDomainVersion,
        title: input.title || session.title,
      };
      return { ...session };
    },
    async getSessionById(sessionId) {
      return sessionId === session.id ? { ...session } : null;
    },
    async listMessages(sessionId) {
      return messages
        .filter((entry) => entry.sessionId === sessionId)
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((entry) => ({ ...entry }));
    },
    async getLatestSummary(sessionId) {
      return (
        summaries
          .filter((entry) => entry.sessionId === sessionId)
          .sort((left, right) => right.createdAt - left.createdAt)[0] || null
      );
    },
    async saveSummary(input) {
      const record: ManagerSummaryRecord = {
        id: `summary_${summaries.length + 1}`,
        sessionId: input.sessionId,
        kind: input.kind,
        cutoffOrdinal: input.cutoffOrdinal,
        summaryText: input.summaryText,
        sourceMessageCount: input.sourceMessageCount,
        createdAt: input.createdAt || 1000 + summaries.length,
      };
      summaries.push(record);
      return { ...record };
    },
    async listMemories(input) {
      const limit = input.limit || 10;
      return memories
        .filter((entry) => entry.scopeType === input.scopeType && entry.scopeId === input.scopeId)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, limit)
        .map((entry) => ({ ...entry }));
    },
    async upsertMemory(input) {
      const existingIndex = memories.findIndex(
        (entry) =>
          entry.scopeType === input.scopeType &&
          entry.scopeId === input.scopeId &&
          entry.memoryType === input.memoryType &&
          entry.keyText === input.keyText,
      );
      const record: ManagerMemoryRecord = {
        id: existingIndex >= 0 ? memories[existingIndex].id : `memory_${memories.length + 1}`,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        memoryType: input.memoryType,
        keyText: input.keyText,
        contentText: input.contentText,
        importance: input.importance ?? null,
        source: input.source ?? null,
        createdAt:
          existingIndex >= 0 ? memories[existingIndex].createdAt : input.createdAt || 1100,
        updatedAt: input.updatedAt || 1100 + memories.length,
      };
      if (existingIndex >= 0) {
        memories[existingIndex] = record;
      } else {
        memories.push(record);
      }
      return { ...record };
    },
    async appendMessage(input) {
      const record: ManagerMessageRecord = {
        id: `message_${messages.length + 1}`,
        sessionId: input.sessionId,
        runId: input.runId || null,
        ordinal: messages.length,
        role: input.role,
        blockType: input.blockType,
        text: input.text || null,
        payloadData: input.payloadData || null,
        createdAt: 100 + messages.length + 1,
      };
      messages.push(record);
      session = {
        ...session,
        latestMessageAt: record.createdAt,
        updatedAt: record.createdAt,
      };
      return { ...record };
    },
    async createRun(input) {
      const record: ManagerRunRecord = {
        id: `run_${runs.length + 1}`,
        sessionId: input.sessionId,
        inputMessageId: input.inputMessageId || null,
        status: input.status,
        triggerType: input.triggerType,
        plannerMode: input.plannerMode || null,
        intentType: input.intentType ?? null,
        toolPath: input.toolPath ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        stateData: input.stateData ?? null,
        startedAt:
          typeof input.startedAt === 'number' && Number.isFinite(input.startedAt)
            ? input.startedAt
            : null,
        finishedAt:
          typeof input.finishedAt === 'number' && Number.isFinite(input.finishedAt)
            ? input.finishedAt
            : null,
        createdAt: input.createdAt || 1200 + runs.length,
        updatedAt: input.updatedAt || input.createdAt || 1200 + runs.length,
      };
      runs.push(record);
      return { ...record };
    },
    async updateRun(runId, patch) {
      const index = runs.findIndex((entry) => entry.id === runId);
      if (index < 0) {
        return null;
      }

      const current = runs[index];
      const updated: ManagerRunRecord = {
        ...current,
        inputMessageId:
          typeof patch.inputMessageId !== 'undefined'
            ? patch.inputMessageId
            : current.inputMessageId,
        status: patch.status ?? current.status,
        plannerMode:
          typeof patch.plannerMode !== 'undefined'
            ? patch.plannerMode
            : current.plannerMode,
        intentType:
          typeof patch.intentType !== 'undefined' ? patch.intentType : current.intentType,
        toolPath: typeof patch.toolPath !== 'undefined' ? patch.toolPath : current.toolPath,
        errorCode:
          typeof patch.errorCode !== 'undefined' ? patch.errorCode : current.errorCode,
        errorMessage:
          typeof patch.errorMessage !== 'undefined'
            ? patch.errorMessage
            : current.errorMessage,
        stateData:
          typeof patch.stateData !== 'undefined' ? patch.stateData : current.stateData,
        startedAt:
          typeof patch.startedAt !== 'undefined' ? patch.startedAt : current.startedAt,
        finishedAt:
          typeof patch.finishedAt !== 'undefined' ? patch.finishedAt : current.finishedAt,
        updatedAt: patch.updatedAt ?? current.updatedAt,
      };
      runs[index] = updated;
      return { ...updated };
    },
    async updateSession(_sessionId, patch) {
      session = {
        ...session,
        title: patch.title ?? session.title,
        runtimeDomainVersion:
          typeof patch.runtimeDomainVersion !== 'undefined'
            ? patch.runtimeDomainVersion
            : session.runtimeDomainVersion,
        activeWorkflowType:
          typeof patch.activeWorkflowType !== 'undefined'
            ? patch.activeWorkflowType
            : session.activeWorkflowType,
        activeWorkflowStateData:
          typeof patch.activeWorkflowStateData !== 'undefined'
            ? patch.activeWorkflowStateData
            : session.activeWorkflowStateData,
        latestSummaryId:
          typeof patch.latestSummaryId !== 'undefined'
            ? patch.latestSummaryId
            : session.latestSummaryId,
        latestMessageAt: patch.latestMessageAt ?? session.latestMessageAt,
        updatedAt: patch.updatedAt ?? session.updatedAt,
      };
      return { ...session };
    },
    async getActiveRun(sessionId): Promise<ManagerRunRecord | null> {
      const activeRuns = runs
        .filter(
          (entry) =>
            entry.sessionId === sessionId &&
            (entry.status === 'queued' || entry.status === 'running'),
        )
        .sort((left, right) => {
          if (left.status === right.status) {
            return right.updatedAt - left.updatedAt;
          }
          return left.status === 'running' ? -1 : 1;
        });
      return activeRuns[0] ? { ...activeRuns[0] } : null;
    },
    async getLatestRun(sessionId): Promise<ManagerRunRecord | null> {
      const latestRuns = runs
        .filter((entry) => entry.sessionId === sessionId)
        .sort((left, right) => {
          if (left.updatedAt === right.updatedAt) {
            return right.createdAt - left.createdAt;
          }
          return right.updatedAt - left.updatedAt;
        });
      return latestRuns[0] ? { ...latestRuns[0] } : null;
    },
    getMessagesSnapshot() {
      return messages.map((entry) => ({ ...entry }));
    },
    getRunsSnapshot() {
      return runs.map((entry) => ({ ...entry }));
    },
  };
}

function createRuntimePack(args: {
  resolverIntent?: AnalysisIntent | null;
  toolResult?: RuntimeToolExecutionResult;
  workflowState?: SessionWorkflowStateSnapshot | null;
  workflowResult?: WorkflowResumeResult;
}) {
  const resolveIntent = vi.fn(async (_input: string, _context?: unknown) => args.resolverIntent || null);
  const toolExecute = vi.fn(async () =>
    args.toolResult || {
      blocks: [],
      diagnostics: {},
    },
  );
  const workflowResume = vi.fn(async () =>
    args.workflowResult || {
      workflowHandled: false,
      blocks: [],
    },
  );

  const pack: DomainRuntimePack = {
    manifest: {
      domainId: 'ops',
      version: '2.0.0',
      displayName: 'Ops',
      supportedIntentTypes: ['query', 'analyze'],
      supportedEventTypes: [],
      supportedFactorIds: [],
    },
    resolver: {
      resolveIntent,
      async resolveSubjects() {
        return [];
      },
      async resolveEvents() {
        return [];
      },
    },
    sourceAdapters: [],
    contextProviders: [],
    tools: [
      {
        id: 'ops_query_status',
        description: 'Query system status.',
        canHandle() {
          return true;
        },
        execute: toolExecute,
      },
    ],
    workflows: [
      {
        workflowType: args.workflowState?.workflowType || 'ops_workflow',
        canResume(state) {
          return state.workflowType === (args.workflowState?.workflowType || 'ops_workflow');
        },
        resume: workflowResume,
      },
    ],
  };

  return {
    pack,
    resolveIntent,
    toolExecute,
    workflowResume,
  };
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

function createAbortError(): Error & { name: string } {
  const error = new Error('Manager run aborted') as Error & { name: string };
  error.name = 'AbortError';
  return error;
}

async function waitForCondition(
  condition: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for test condition.');
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

describe('manager gateway submit', () => {
  it('appends the user turn, executes a deterministic tool, and returns the updated projection', async () => {
    const toolBlocks: RuntimeFeedBlockInput[] = [
      {
        blockType: 'assistant_text',
        role: 'assistant',
        text: 'System status is green.',
      },
    ];
    const runtime = createRuntimePack({
      resolverIntent: {
        domainId: 'ops',
        intentType: 'query',
        rawInput: 'show system status',
      },
      toolResult: {
        blocks: toolBlocks,
        sessionPatch: {
          title: 'Ops session',
          activeWorkflow: null,
        },
        diagnostics: {
          feedbackMessage: 'Status loaded.',
          shouldRefreshTaskState: false,
        },
      },
    });

    const gateway = createManagerGateway({
      sessionStore: createMutableSessionStore(),
      runtimeDomainRegistry: {
        resolve: () => runtime.pack,
      },
    });

    const result = await gateway.submitMainSessionTurn({
      input: 'show system status',
      language: 'en',
      domainId: 'ops',
      title: 'Ops session',
    });

    expect(result.plannerMode).toBe('deterministic');
    expect(result.toolId).toBe('ops_query_status');
    expect(result.feedbackMessage).toBe('Status loaded.');
    expect(result.shouldRefreshTaskState).toBe(false);
    expect(result.projection.session.title).toBe('Ops session');
    expect(result.projection.feed.map((entry) => entry.blockType)).toEqual([
      'user_text',
      'assistant_text',
    ]);
    expect(result.projection.feed[0].text).toBe('show system status');
    expect(result.projection.feed[1].text).toBe('System status is green.');
    expect(runtime.resolveIntent).toHaveBeenCalledTimes(1);
    expect(runtime.toolExecute).toHaveBeenCalledTimes(1);
    expect(runtime.workflowResume).not.toHaveBeenCalled();
  });

  it('resumes the active workflow before trying deterministic tools', async () => {
    const workflowState: SessionWorkflowStateSnapshot = {
      workflowType: 'ops_workflow',
      stateData: {
        step: 'await_confirmation',
      },
    };
    const runtime = createRuntimePack({
      workflowState,
      workflowResult: {
        workflowHandled: true,
        blocks: [
          {
            blockType: 'assistant_text',
            role: 'assistant',
            text: 'Confirmed. Executing next step.',
          },
        ],
        sessionPatch: {
          activeWorkflow: {
            workflowType: 'ops_workflow',
            stateData: {
              step: 'completed',
            },
          },
        },
        diagnostics: {
          feedbackMessage: 'Workflow advanced.',
          shouldRefreshTaskState: true,
        },
      },
    });

    const gateway = createManagerGateway({
      sessionStore: createMutableSessionStore({
        activeWorkflowType: 'ops_workflow',
        activeWorkflowStateData: JSON.stringify(workflowState.stateData),
      }),
      runtimeDomainRegistry: {
        resolve: () => runtime.pack,
      },
    });

    const result = await gateway.submitMainSessionTurn({
      input: 'confirm',
      language: 'en',
      domainId: 'ops',
      title: 'Ops session',
    });

    expect(result.plannerMode).toBe('workflow');
    expect(result.workflowType).toBe('ops_workflow');
    expect(result.feedbackMessage).toBe('Workflow advanced.');
    expect(result.shouldRefreshTaskState).toBe(true);
    expect(result.projection.activeWorkflow).toEqual({
      workflowType: 'ops_workflow',
      stateData: {
        step: 'completed',
      },
    });
    expect(result.projection.feed.map((entry) => entry.blockType)).toEqual([
      'user_text',
      'assistant_text',
    ]);
    expect(runtime.workflowResume).toHaveBeenCalledTimes(1);
    expect(runtime.resolveIntent).not.toHaveBeenCalled();
    expect(runtime.toolExecute).not.toHaveBeenCalled();
  });

  it('uses the llm planner in strict mode before any workflow or deterministic tool path', async () => {
    const runtime = createRuntimePack({
      resolverIntent: {
        domainId: 'ops',
        intentType: 'query',
        rawInput: 'show system status',
      },
    });
    const llmPlanner: ManagerGatewayLlmPlanner = {
      planTurn: vi.fn(async () => ({
        blocks: [
          {
            blockType: 'assistant_text' as const,
            role: 'assistant' as const,
            text: 'Planned by LLM.',
          },
        ] satisfies RuntimeFeedBlockInput[],
        diagnostics: {
          feedbackMessage: 'LLM handled.',
        },
      })),
    };

    const gateway = createManagerGateway({
      sessionStore: createMutableSessionStore(),
      runtimeDomainRegistry: {
        resolve: () => runtime.pack,
      },
      llmPlanner,
    });

    const result = await gateway.submitMainSessionTurn({
      input: 'show system status',
      language: 'en',
      domainId: 'ops',
      title: 'Ops session',
      allowHeuristicFallback: false,
    });

    expect(result.plannerMode).toBe('llm_assisted');
    expect(result.feedbackMessage).toBe('LLM handled.');
    expect(result.projection.feed.map((entry) => entry.blockType)).toEqual([
      'user_text',
      'assistant_text',
    ]);
    expect(result.projection.feed[1].text).toBe('Planned by LLM.');
    expect(llmPlanner.planTurn).toHaveBeenCalledTimes(1);
    expect(runtime.workflowResume).not.toHaveBeenCalled();
    expect(runtime.resolveIntent).toHaveBeenCalledTimes(1);
    expect(runtime.toolExecute).not.toHaveBeenCalled();
  });

  it('assembles context, persists memory writes, and stores a rolling summary after a deterministic turn', async () => {
    const toolExecute = vi.fn(async (input: { contextFragments?: unknown[] }) => ({
      blocks: [
        {
          blockType: 'assistant_text' as const,
          role: 'assistant' as const,
          text: 'Context-aware answer.',
        },
      ],
      memoryWrites: [
        {
          scopeType: 'domain' as const,
          scopeId: 'ops',
          memoryType: 'preference',
          keyText: 'status_focus',
          contentText: 'Prefer status-first explanations.',
          importance: 0.9,
        },
      ],
      diagnostics: {
        feedbackMessage: 'Context aware.',
      },
      sessionPatch: {
        activeWorkflow: null,
      },
    }));
    const runtime = createRuntimePack({
      resolverIntent: {
        domainId: 'ops',
        intentType: 'query',
        rawInput: 'show system status',
      },
      toolResult: {
        blocks: [],
      },
    });
    runtime.pack.contextProviders = [
      {
        id: 'ops_context',
        collect: vi.fn(async () => [
          {
            id: 'ops_domain_state',
            category: 'domain_state' as const,
            priority: 70,
            text: 'Ops provider state.',
          },
        ]),
      },
    ];
    runtime.pack.tools[0].execute = toolExecute;

    const store = createMutableSessionStore();
    const session = await store.getOrCreateMainSession({
      domainId: 'ops',
      runtimeDomainVersion: '2.0.0',
      title: 'Ops session',
    });
    for (let index = 0; index < 14; index += 1) {
      await store.appendMessage?.({
        sessionId: session.id,
        role: index % 2 === 0 ? 'user' : 'assistant',
        blockType: index % 2 === 0 ? 'user_text' : 'assistant_text',
        text: `Historical message ${index + 1}`,
        createdAt: 100 + index,
      });
    }

    const gateway = createManagerGateway({
      sessionStore: store,
      runtimeDomainRegistry: {
        resolve: () => runtime.pack,
      },
    });

    const result = await gateway.submitMainSessionTurn({
      input: 'show system status',
      language: 'en',
      domainId: 'ops',
      title: 'Ops session',
    });

    expect(toolExecute).toHaveBeenCalledTimes(1);
    expect(Array.isArray(toolExecute.mock.calls[0][0].contextFragments)).toBe(true);
    expect(toolExecute.mock.calls[0][0].contextFragments.length).toBeGreaterThan(0);
    expect(result.projection.contextUsage?.fragmentCount).toBeGreaterThan(0);
    expect(
      result.projection.contextSnapshot?.fragments.some(
        (fragment) => fragment.category === 'domain_state',
      ),
    ).toBe(true);
    expect(result.projection.session.latestSummaryId).toBeTruthy();
    await expect(
      store.listMemories?.({
        scopeType: 'domain',
        scopeId: 'ops',
        limit: 10,
      }),
    ).resolves.toHaveLength(1);
  });

  it('queues same-session submissions and preserves grouped message ordering', async () => {
    const firstToolStarted = createDeferred();
    const releaseFirstTool = createDeferred();
    const executionInputs: string[] = [];
    const runtime = createRuntimePack({
      resolverIntent: {
        domainId: 'ops',
        intentType: 'query',
        rawInput: 'placeholder',
      },
      toolResult: {
        blocks: [],
      },
    });
    runtime.resolveIntent.mockImplementation(async (input: string, _context?: unknown) => ({
      domainId: 'ops',
      intentType: 'query',
      rawInput: input,
    }));
    runtime.pack.tools[0].execute = vi.fn(async (toolInput: { input: string }) => {
      const { input } = toolInput;
      executionInputs.push(input);
      if (input === 'first request') {
        firstToolStarted.resolve();
        await releaseFirstTool.promise;
        return {
          blocks: [
            {
              blockType: 'assistant_text' as const,
              role: 'assistant' as const,
              text: 'First response.',
            },
          ],
          diagnostics: {},
        };
      }

      return {
        blocks: [
          {
            blockType: 'assistant_text' as const,
            role: 'assistant' as const,
            text: 'Second response.',
          },
        ],
        diagnostics: {},
      };
    });

    const store = createMutableSessionStore();
    const gateway = createManagerGateway({
      sessionStore: store,
      runtimeDomainRegistry: {
        resolve: () => runtime.pack,
      },
    });

    const firstPromise = gateway.submitMainSessionTurn({
      input: 'first request',
      language: 'en',
      domainId: 'ops',
      title: 'Ops session',
    });
    await firstToolStarted.promise;

    const secondPromise = gateway.submitMainSessionTurn({
      input: 'second request',
      language: 'en',
      domainId: 'ops',
      title: 'Ops session',
    });

    await waitForCondition(() => store.getRunsSnapshot().length === 2);

    const queuedRuns = store.getRunsSnapshot();
    expect(queuedRuns).toHaveLength(2);
    expect(queuedRuns[0].status).toBe('running');
    expect(queuedRuns[1].status).toBe('queued');
    await expect(store.getActiveRun?.('session_main')).resolves.toMatchObject({
      id: queuedRuns[0].id,
      status: 'running',
    });

    releaseFirstTool.resolve();
    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);

    expect(firstResult.plannerMode).toBe('deterministic');
    expect(secondResult.plannerMode).toBe('deterministic');
    expect(executionInputs).toEqual(['first request', 'second request']);
    expect(store.getMessagesSnapshot().map((entry) => entry.text)).toEqual([
      'first request',
      'First response.',
      'second request',
      'Second response.',
    ]);
    expect(store.getRunsSnapshot().map((entry) => entry.status)).toEqual([
      'completed',
      'completed',
    ]);
  });

  it('cancels a queued follow-up run before execution and leaves the active run untouched', async () => {
    const firstToolStarted = createDeferred();
    const releaseFirstTool = createDeferred();
    const executionInputs: string[] = [];
    const runtime = createRuntimePack({
      resolverIntent: {
        domainId: 'ops',
        intentType: 'query',
        rawInput: 'placeholder',
      },
      toolResult: {
        blocks: [],
      },
    });
    runtime.resolveIntent.mockImplementation(async (input: string, _context?: unknown) => ({
      domainId: 'ops',
      intentType: 'query',
      rawInput: input,
    }));
    runtime.pack.tools[0].execute = vi.fn(async (toolInput: { input: string }) => {
      const { input } = toolInput;
      executionInputs.push(input);
      if (input === 'first request') {
        firstToolStarted.resolve();
        await releaseFirstTool.promise;
        return {
          blocks: [
            {
              blockType: 'assistant_text' as const,
              role: 'assistant' as const,
              text: 'First response.',
            },
          ],
          diagnostics: {},
        };
      }

      return {
        blocks: [
          {
            blockType: 'assistant_text' as const,
            role: 'assistant' as const,
            text: 'Second response.',
          },
        ],
        diagnostics: {},
      };
    });

    const store = createMutableSessionStore();
    const gateway = createManagerGateway({
      sessionStore: store,
      runtimeDomainRegistry: {
        resolve: () => runtime.pack,
      },
    });

    const firstPromise = gateway.submitMainSessionTurn({
      input: 'first request',
      language: 'en',
      domainId: 'ops',
      title: 'Ops session',
    });
    await firstToolStarted.promise;

    const secondPromise = gateway.submitMainSessionTurn({
      input: 'second request',
      language: 'en',
      domainId: 'ops',
      title: 'Ops session',
    });

    await waitForCondition(() => store.getRunsSnapshot().length === 2);
    const queuedRun = store.getRunsSnapshot()[1];

    const cancelResult = await gateway.cancelSessionRun('session_main');

    expect(cancelResult.outcome).toBe('cancelled');
    expect(cancelResult.runId).toBe(queuedRun.id);
    expect(cancelResult.projection.latestRun).toMatchObject({
      id: queuedRun.id,
      status: 'cancelled',
      errorCode: 'cancelled_by_user',
    });

    releaseFirstTool.resolve();
    await expect(firstPromise).resolves.toMatchObject({
      plannerMode: 'deterministic',
    });
    await expect(secondPromise).rejects.toThrow('cancelled');
    expect(executionInputs).toEqual(['first request']);
    expect(store.getRunsSnapshot().map((entry) => entry.status)).toEqual([
      'completed',
      'cancelled',
    ]);
  });

  it('interrupts a currently running run and persists it as cancelled', async () => {
    const firstToolStarted = createDeferred();
    const runtime = createRuntimePack({
      resolverIntent: {
        domainId: 'ops',
        intentType: 'query',
        rawInput: 'placeholder',
      },
      toolResult: {
        blocks: [],
      },
    });
    runtime.resolveIntent.mockImplementation(async (input: string, _context?: unknown) => ({
      domainId: 'ops',
      intentType: 'query',
      rawInput: input,
    }));
    runtime.pack.tools[0].execute = vi.fn(
      async (toolInput: { input: string; signal?: AbortSignal }) => {
        if (toolInput.input !== 'first request') {
          return {
            blocks: [
              {
                blockType: 'assistant_text' as const,
                role: 'assistant' as const,
                text: 'Unexpected response.',
              },
            ],
            diagnostics: {},
          };
        }

        firstToolStarted.resolve();
        await new Promise((_, reject) => {
          toolInput.signal?.addEventListener(
            'abort',
            () => {
              reject(createAbortError());
            },
            { once: true },
          );
        });

        return {
          blocks: [],
          diagnostics: {},
        };
      },
    );

    const store = createMutableSessionStore();
    const gateway = createManagerGateway({
      sessionStore: store,
      runtimeDomainRegistry: {
        resolve: () => runtime.pack,
      },
    });

    const firstPromise = gateway.submitMainSessionTurn({
      input: 'first request',
      language: 'en',
      domainId: 'ops',
      title: 'Ops session',
    });
    await firstToolStarted.promise;

    const runningRun = store.getRunsSnapshot()[0];
    const cancelResult = await gateway.cancelSessionRun('session_main');

    expect(cancelResult).toMatchObject({
      outcome: 'interrupt_requested',
      runId: runningRun.id,
    });
    expect(runtime.pack.tools[0].execute).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    await expect(firstPromise).rejects.toMatchObject({
      name: 'AbortError',
    });
    await waitForCondition(() => store.getRunsSnapshot()[0].status === 'cancelled');
    expect(store.getRunsSnapshot()[0]).toMatchObject({
      status: 'cancelled',
      errorCode: 'aborted_by_user',
      errorMessage: 'Interrupted by user.',
    });
  });
});
