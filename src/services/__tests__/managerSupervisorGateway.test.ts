import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  ManagerGatewaySessionStore,
  ManagerMessageRecord,
  ManagerRunRecord,
  ManagerSessionRecord,
  ManagerSummaryRecord,
} from '@/src/services/manager-gateway/types';

function buildMainSessionKey(input: {
  domainId: string;
  sessionKind?: string | null;
}): string {
  if (input.sessionKind === 'supervisor') {
    return 'manager:main:supervisor';
  }

  return input.domainId === 'football' ? 'manager:main' : `manager:main:${input.domainId}`;
}

function createMutableSessionStore(): ManagerGatewaySessionStore & {
  getSessionsSnapshot(): ManagerSessionRecord[];
  getMessagesSnapshot(): ManagerMessageRecord[];
  getRunsSnapshot(): ManagerRunRecord[];
} {
  const sessions: ManagerSessionRecord[] = [];
  const messages: ManagerMessageRecord[] = [];
  const runs: ManagerRunRecord[] = [];
  const summaries: ManagerSummaryRecord[] = [];

  return {
    async getOrCreateMainSession(input: {
      domainId: string;
      runtimeDomainVersion?: string | null;
      title?: string;
      sessionKind?: string;
    }) {
      const sessionKey = buildMainSessionKey({
        domainId: input.domainId,
        sessionKind: input.sessionKind,
      });
      const existing = sessions.find((entry) => entry.sessionKey === sessionKey);
      if (existing) {
        return {
          ...existing,
          title: input.title || existing.title,
          domainId: input.domainId || existing.domainId,
          runtimeDomainVersion: input.runtimeDomainVersion || existing.runtimeDomainVersion,
        };
      }

      const now = 100 + sessions.length;
      const record: ManagerSessionRecord = {
        id: `session_${sessions.length + 1}`,
        sessionKey,
        sessionKind:
          input.sessionKind === 'supervisor' || input.sessionKind === 'domain_child'
            ? input.sessionKind
            : 'domain_main',
        parentSessionId: null,
        ownerDomainId: null,
        title: input.title || 'Main session',
        status: 'active',
        domainId: input.domainId,
        runtimeDomainVersion: input.runtimeDomainVersion || '1.0.0',
        activeWorkflowType: null,
        activeWorkflowStateData: null,
        compositeWorkflowStateData: null,
        latestSummaryId: null,
        latestMessageAt: now,
        createdAt: now,
        updatedAt: now,
      };
      sessions.push(record);
      return { ...record };
    },
    async createSession(input) {
      const existing = sessions.find((entry) => entry.sessionKey === input.sessionKey);
      if (existing) {
        return { ...existing };
      }

      const now = 200 + sessions.length;
      const record: ManagerSessionRecord = {
        id: `session_${sessions.length + 1}`,
        sessionKey: input.sessionKey,
        sessionKind: input.sessionKind,
        parentSessionId: input.parentSessionId || null,
        ownerDomainId: input.ownerDomainId || null,
        title: input.title || 'Child session',
        status: 'active',
        domainId: input.domainId,
        runtimeDomainVersion: input.runtimeDomainVersion || '1.0.0',
        activeWorkflowType: null,
        activeWorkflowStateData: null,
        compositeWorkflowStateData: null,
        latestSummaryId: null,
        latestMessageAt: now,
        createdAt: now,
        updatedAt: now,
      };
      sessions.push(record);
      return { ...record };
    },
    async getSessionById(sessionId) {
      const record = sessions.find((entry) => entry.id === sessionId);
      return record ? { ...record } : null;
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
      const summary: ManagerSummaryRecord = {
        id: `summary_${summaries.length + 1}`,
        sessionId: input.sessionId,
        kind: input.kind,
        cutoffOrdinal: input.cutoffOrdinal,
        summaryText: input.summaryText,
        sourceMessageCount: input.sourceMessageCount,
        createdAt: input.createdAt || 500 + summaries.length,
      };
      summaries.push(summary);
      return { ...summary };
    },
    async appendMessage(input) {
      const sessionMessages = messages.filter((entry) => entry.sessionId === input.sessionId);
      const ordinal =
        sessionMessages.reduce((maxOrdinal, entry) => Math.max(maxOrdinal, entry.ordinal), -1) + 1;
      const record: ManagerMessageRecord = {
        id: `message_${messages.length + 1}`,
        sessionId: input.sessionId,
        runId: input.runId || null,
        ordinal,
        role: input.role,
        blockType: input.blockType,
        text: input.text || null,
        payloadData: input.payloadData || null,
        createdAt: input.createdAt || 300 + messages.length,
      };
      messages.push(record);
      const sessionIndex = sessions.findIndex((entry) => entry.id === input.sessionId);
      if (sessionIndex >= 0) {
        sessions[sessionIndex] = {
          ...sessions[sessionIndex],
          latestMessageAt: record.createdAt,
          updatedAt: record.createdAt,
        };
      }
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
        createdAt: input.createdAt || 600 + runs.length,
        updatedAt: input.updatedAt || input.createdAt || 600 + runs.length,
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
    async updateSession(sessionId, patch) {
      const index = sessions.findIndex((entry) => entry.id === sessionId);
      if (index < 0) {
        return null;
      }

      const current = sessions[index];
      const updated: ManagerSessionRecord = {
        ...current,
        title: patch.title ?? current.title,
        runtimeDomainVersion:
          typeof patch.runtimeDomainVersion !== 'undefined'
            ? patch.runtimeDomainVersion
            : current.runtimeDomainVersion,
        activeWorkflowType:
          typeof patch.activeWorkflowType !== 'undefined'
            ? patch.activeWorkflowType
            : current.activeWorkflowType,
        activeWorkflowStateData:
          typeof patch.activeWorkflowStateData !== 'undefined'
            ? patch.activeWorkflowStateData
            : current.activeWorkflowStateData,
        compositeWorkflowStateData:
          typeof patch.compositeWorkflowStateData !== 'undefined'
            ? patch.compositeWorkflowStateData
            : current.compositeWorkflowStateData,
        latestSummaryId:
          typeof patch.latestSummaryId !== 'undefined'
            ? patch.latestSummaryId
            : current.latestSummaryId,
        latestMessageAt: patch.latestMessageAt ?? current.latestMessageAt,
        updatedAt: patch.updatedAt ?? current.updatedAt,
      };
      sessions[index] = updated;
      return { ...updated };
    },
    async getActiveRun(sessionId) {
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
    async getLatestRun(sessionId) {
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
    getSessionsSnapshot() {
      return sessions.map((entry) => ({ ...entry }));
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
  domainId: string;
  resolverIntent?: AnalysisIntent | null;
  toolResult?: RuntimeToolExecutionResult;
  workflowState?: SessionWorkflowStateSnapshot | null;
  workflowResult?: WorkflowResumeResult;
}) {
  const resolveIntent = vi.fn(async () => args.resolverIntent || null);
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
      domainId: args.domainId,
      version: '2.0.0',
      displayName: args.domainId,
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
    manager: {
      domainId: args.domainId,
      skillIds: [],
    },
    tools: [
      {
        id: `${args.domainId}_tool`,
        description: `${args.domainId} tool`,
        canHandle() {
          return true;
        },
        execute: toolExecute,
      },
    ],
    workflows: [
      {
        workflowType: args.workflowState?.workflowType || `${args.domainId}_workflow`,
        canResume(state) {
          return state.workflowType === (args.workflowState?.workflowType || `${args.domainId}_workflow`);
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

describe('manager supervisor gateway', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('creates a supervisor main session projection', async () => {
    const store = createMutableSessionStore();
    const footballRuntime = createRuntimePack({
      domainId: 'football',
    });
    const gateway = createManagerGateway({
      sessionStore: store,
      runtimeDomainRegistry: {
        resolve: () => footballRuntime.pack,
      },
    });

    const projection = await gateway.getOrCreateMainSession({
      domainId: 'football',
      title: 'Command Center',
      sessionKind: 'supervisor',
    } as any);

    expect(projection.session.sessionKind).toBe('supervisor');
    expect(projection.session.sessionKey).toBe('manager:main:supervisor');
    expect(projection.compositeWorkflow).toBeNull();
  });

  it('creates a child session for the active routed item and persists composite workflow state', async () => {
    const store = createMutableSessionStore();
    const footballRuntime = createRuntimePack({
      domainId: 'football',
      resolverIntent: {
        domainId: 'football',
        intentType: 'analyze',
        targetType: 'event',
        eventRefs: [
          {
            domainId: 'football',
            eventType: 'match',
            eventId: 'rm-barca',
            title: 'Real Madrid vs Barcelona',
            subjectRefs: [],
          },
        ],
        rawInput: 'Analyze Real Madrid vs Barcelona',
      },
      toolResult: {
        blocks: [
          {
            blockType: 'assistant_text',
            role: 'assistant',
            text: 'Choose analysis factors.',
          } satisfies RuntimeFeedBlockInput,
        ],
        sessionPatch: {
          activeWorkflow: {
            workflowType: 'football_task_intake',
            stateData: {
              step: 'await_factors',
            },
          },
        },
      },
    });
    const projectOpsRuntime = createRuntimePack({
      domainId: 'project_ops',
      resolverIntent: {
        domainId: 'project_ops',
        intentType: 'analyze',
        targetType: 'subject',
        subjectRefs: [
          {
            domainId: 'project_ops',
            subjectType: 'project',
            subjectId: 'q2-mobile-launch',
            label: 'Q2 mobile launch blockers',
          },
        ],
        rawInput: 'Review Q2 mobile launch blockers',
      },
      toolResult: {
        blocks: [
          {
            blockType: 'assistant_text',
            role: 'assistant',
            text: 'Project ops execution should stay pending.',
          } satisfies RuntimeFeedBlockInput,
        ],
      },
    });
    const runtimePacks = {
      football: footballRuntime.pack,
      project_ops: projectOpsRuntime.pack,
    } as const;
    const gateway = createManagerGateway({
      sessionStore: store,
      runtimeDomainRegistry: {
        resolve(domainId) {
          return runtimePacks[(domainId || 'football') as keyof typeof runtimePacks];
        },
        getById(domainId) {
          return domainId ? runtimePacks[domainId as keyof typeof runtimePacks] || null : null;
        },
        list() {
          return [footballRuntime.pack, projectOpsRuntime.pack];
        },
      } as any,
    });

    const result = await gateway.submitMainSessionTurn({
      input: 'Analyze Real Madrid vs Barcelona and review Q2 mobile launch blockers',
      language: 'en',
      domainId: 'football',
      title: 'Command Center',
      sessionKind: 'supervisor',
    } as any);

    const workflow = result.projection.compositeWorkflow;
    const footballItem = workflow?.items.find((item) => item.domainId === 'football');
    const projectOpsItem = workflow?.items.find((item) => item.domainId === 'project_ops');
    const reloaded = await gateway.loadSessionProjection(result.projection.session.id);

    expect(result.projection.session.sessionKind).toBe('supervisor');
    expect(workflow?.items).toHaveLength(2);
    expect(footballItem).toMatchObject({
      status: 'active',
      childWorkflowType: 'football_task_intake',
      summary: 'Choose analysis factors.',
    });
    expect(footballItem?.childSessionId).toBeTruthy();
    expect(footballItem?.childWorkflowStateData).toEqual({
      step: 'await_factors',
    });
    expect(projectOpsItem).toMatchObject({
      status: 'pending',
      childSessionId: null,
    });
    expect(store.getSessionsSnapshot().filter((entry) => entry.sessionKind === 'domain_child')).toHaveLength(1);
    expect(footballRuntime.toolExecute).toHaveBeenCalledTimes(1);
    expect(projectOpsRuntime.toolExecute).not.toHaveBeenCalled();
    expect(result.projection.feed.map((entry) => entry.text)).toContain('Choose analysis factors.');
    expect(reloaded?.compositeWorkflow).toEqual(workflow);
  });

  it('continues only the active child session and does not dispatch the next item in the same turn', async () => {
    const store = createMutableSessionStore();
    const footballWorkflowState: SessionWorkflowStateSnapshot = {
      workflowType: 'football_task_intake',
      stateData: {
        step: 'await_factors',
      },
    };
    const footballRuntime = createRuntimePack({
      domainId: 'football',
      resolverIntent: {
        domainId: 'football',
        intentType: 'analyze',
        targetType: 'event',
        eventRefs: [
          {
            domainId: 'football',
            eventType: 'match',
            eventId: 'rm-barca',
            title: 'Real Madrid vs Barcelona',
            subjectRefs: [],
          },
        ],
        rawInput: 'Analyze Real Madrid vs Barcelona',
      },
      toolResult: {
        blocks: [
          {
            blockType: 'assistant_text',
            role: 'assistant',
            text: 'Choose analysis factors.',
          } satisfies RuntimeFeedBlockInput,
        ],
        sessionPatch: {
          activeWorkflow: footballWorkflowState,
        },
      },
      workflowState: footballWorkflowState,
      workflowResult: {
        workflowHandled: true,
        blocks: [
          {
            blockType: 'assistant_text',
            role: 'assistant',
            text: 'Football analysis configured.',
          } satisfies RuntimeFeedBlockInput,
        ],
        sessionPatch: {
          activeWorkflow: null,
        },
      },
    });
    const projectOpsRuntime = createRuntimePack({
      domainId: 'project_ops',
      resolverIntent: {
        domainId: 'project_ops',
        intentType: 'analyze',
        targetType: 'subject',
        subjectRefs: [
          {
            domainId: 'project_ops',
            subjectType: 'project',
            subjectId: 'q2-mobile-launch',
            label: 'Q2 mobile launch blockers',
          },
        ],
        rawInput: 'Review Q2 mobile launch blockers',
      },
      toolResult: {
        blocks: [
          {
            blockType: 'assistant_text',
            role: 'assistant',
            text: 'Project ops should not start in the same supervisor turn.',
          } satisfies RuntimeFeedBlockInput,
        ],
      },
    });
    const runtimePacks = {
      football: footballRuntime.pack,
      project_ops: projectOpsRuntime.pack,
    } as const;
    const gateway = createManagerGateway({
      sessionStore: store,
      runtimeDomainRegistry: {
        resolve(domainId) {
          return runtimePacks[(domainId || 'football') as keyof typeof runtimePacks];
        },
        getById(domainId) {
          return domainId ? runtimePacks[domainId as keyof typeof runtimePacks] || null : null;
        },
        list() {
          return [footballRuntime.pack, projectOpsRuntime.pack];
        },
      } as any,
    });

    await gateway.submitMainSessionTurn({
      input: 'Analyze Real Madrid vs Barcelona and review Q2 mobile launch blockers',
      language: 'en',
      domainId: 'football',
      title: 'Command Center',
      sessionKind: 'supervisor',
    } as any);

    const result = await gateway.submitMainSessionTurn({
      input: 'default',
      language: 'en',
      domainId: 'football',
      title: 'Command Center',
      sessionKind: 'supervisor',
    } as any);

    const workflow = result.projection.compositeWorkflow;
    const footballItem = workflow?.items.find((item) => item.domainId === 'football');
    const projectOpsItem = workflow?.items.find((item) => item.domainId === 'project_ops');

    expect(footballRuntime.resolveIntent).toHaveBeenCalledTimes(2);
    expect(projectOpsRuntime.resolveIntent).toHaveBeenCalledTimes(1);
    expect(footballRuntime.workflowResume).toHaveBeenCalledTimes(1);
    expect(projectOpsRuntime.toolExecute).not.toHaveBeenCalled();
    expect(store.getSessionsSnapshot().filter((entry) => entry.sessionKind === 'domain_child')).toHaveLength(1);
    expect(footballItem).toMatchObject({
      status: 'completed',
      summary: 'Football analysis configured.',
    });
    expect(projectOpsItem).toMatchObject({
      status: 'active',
      childSessionId: null,
    });
    expect(workflow?.activeItemId).toBe(projectOpsItem?.itemId);
  });
});
