import type {
  AnalysisIntent,
  RuntimeConversationTurn,
  RuntimeFeedBlockInput,
  RuntimeSessionSnapshot,
  RuntimeToolExecutionResult,
  SessionWorkflowStateSnapshot,
  WorkflowResumeResult,
} from '@/src/domains/runtime/types';
import {
  listRuntimeDomainPacks,
  resolveRuntimeDomainPack,
} from '@/src/domains/runtime/registry';
import type { MemoryCandidateInput } from '@/src/services/memoryCandidateTypes';
import { persistMemoryCandidates } from '@/src/services/memoryCandidateStore';
import { resolveRuntimeManagerRoutingResult } from '@/src/services/manager/runtimeIntentRouter';
import { createChildSessionBridge } from '@/src/services/manager-orchestration/childSessionBridge';
import {
  cancelCompositeWorkflow,
  createCompositeWorkflow,
  parseCompositeWorkflowSnapshot,
  serializeCompositeWorkflow,
  syncChildStateIntoCompositeItem,
} from '@/src/services/manager-orchestration/compositeWorkflow';
import {
  buildGatewayActiveChildDiagnostics,
  buildGatewayChildSyncDiagnostics,
  buildGatewayMigrationDiagnostics,
  buildGatewayRoutingDiagnostics,
  withOrchestrationDiagnostics,
} from '@/src/services/manager-orchestration/diagnostics';
import type {
  ManagerCompositeItem,
  ManagerCompositeWorkflowState,
  ManagerRoutingResult,
} from '@/src/services/manager-orchestration/types';
import { createManagerContextAssembler } from './contextAssembler';
import { createManagerMemoryService } from './memoryService';
import { createManagerRunCoordinator } from './runCoordinator';
import { createManagerSummaryService } from './summaryService';
import type {
  GetOrCreateMainSessionInput,
  ManagerFeedBlock,
  ManagerGateway,
  ManagerGatewayContextAssembler,
  ManagerGatewayLlmPlanner,
  ManagerGatewayMemoryService,
  ManagerGatewayRunCancelResult,
  ManagerGatewayRunCoordinator,
  ManagerGatewaySessionStore,
  ManagerGatewaySummaryService,
  ManagerGatewayTurnResult,
  ManagerMessageBlockType,
  ManagerMessageRole,
  ManagerRunRecord,
  ManagerRuntimeDomainRegistry,
  ManagerSessionProjection,
  ManagerSessionRecord,
  SubmitMainSessionTurnInput,
} from './types';

function parseActiveWorkflow(session: ManagerSessionRecord): SessionWorkflowStateSnapshot | null {
  if (!session.activeWorkflowType) {
    return null;
  }

  if (!session.activeWorkflowStateData) {
    return {
      workflowType: session.activeWorkflowType,
      stateData: {},
    };
  }

  try {
    const parsed = JSON.parse(session.activeWorkflowStateData);
    return {
      workflowType: session.activeWorkflowType,
      stateData: parsed && typeof parsed === 'object' ? parsed : {},
    };
  } catch {
    return {
      workflowType: session.activeWorkflowType,
      stateData: {},
    };
  }
}

function parseCompositeWorkflow(session: ManagerSessionRecord) {
  return parseCompositeWorkflowSnapshot(session.compositeWorkflowStateData);
}

function projectFeed(
  messages: Awaited<ReturnType<ManagerGatewaySessionStore['listMessages']>>,
): ManagerFeedBlock[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    blockType: message.blockType,
    text: message.text,
    payloadData: message.payloadData,
    createdAt: message.createdAt,
  }));
}

async function buildSessionProjection(args: {
  session: ManagerSessionRecord;
  runtimeDomainRegistry: ManagerRuntimeDomainRegistry;
  messages: Awaited<ReturnType<ManagerGatewaySessionStore['listMessages']>>;
  activeRun: Awaited<ReturnType<NonNullable<ManagerGatewaySessionStore['getActiveRun']>>> | null;
  latestRun: Awaited<ReturnType<NonNullable<ManagerGatewaySessionStore['getLatestRun']>>> | null;
  contextAssembler: ManagerGatewayContextAssembler;
  intent?: AnalysisIntent | null;
}): Promise<ManagerSessionProjection> {
  const runtimePack = args.runtimeDomainRegistry.resolve(args.session.domainId);
  const projection: ManagerSessionProjection = {
    session: args.session,
    runtimeDomainId: runtimePack.manifest.domainId,
    runtimeDomainVersion: runtimePack.manifest.version,
    feed: projectFeed(args.messages),
    activeRun: args.activeRun,
    latestRun: args.latestRun,
    activeWorkflow:
      args.session.sessionKind === 'supervisor' ? null : parseActiveWorkflow(args.session),
    compositeWorkflow: parseCompositeWorkflow(args.session),
  };

  const context = await args.contextAssembler.assemble({
    session: projection.session,
    activeRun: projection.activeRun,
    activeWorkflow: projection.activeWorkflow,
    feed: projection.feed,
    runtimePack,
    intent: args.intent,
    recentMessages: mapFeedToRuntimeConversation(projection.feed),
  });

  return {
    ...projection,
    contextUsage: context.usage,
    contextSnapshot: context.snapshot,
  };
}

function mapFeedToRuntimeConversation(messages: ManagerFeedBlock[]): RuntimeConversationTurn[] {
  return messages
    .filter((message) => typeof message.text === 'string' && message.text.trim().length > 0)
    .map((message) => ({
      role: message.role,
      text: message.text || '',
      blockType: message.blockType,
      createdAt: message.createdAt,
    }));
}

function createRuntimeSessionSnapshot(projection: ManagerSessionProjection): RuntimeSessionSnapshot {
  return {
    sessionId: projection.session.id,
    sessionKey: projection.session.sessionKey,
    domainId: projection.session.domainId,
    title: projection.session.title,
    runtimeDomainVersion: projection.runtimeDomainVersion,
    activeWorkflow: projection.activeWorkflow,
  };
}

function serializePayloadData(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) {
    return null;
  }
  return JSON.stringify(payload);
}

function mapRuntimeRole(role: RuntimeFeedBlockInput['role'] | undefined): ManagerMessageRole {
  if (role === 'system') {
    return 'system';
  }
  return 'assistant';
}

function mapRuntimeBlockType(blockType: RuntimeFeedBlockInput['blockType']): ManagerMessageBlockType {
  return blockType;
}

function extractFeedbackMessage(
  result: RuntimeToolExecutionResult | WorkflowResumeResult,
): string | undefined {
  const raw = result.diagnostics?.feedbackMessage;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
}

function extractShouldRefreshTaskState(
  result: RuntimeToolExecutionResult | WorkflowResumeResult,
): boolean {
  return Boolean(result.diagnostics?.shouldRefreshTaskState);
}

function extractMemoryCandidates(
  result: RuntimeToolExecutionResult | WorkflowResumeResult,
): MemoryCandidateInput[] {
  const raw = result.diagnostics?.memoryCandidates;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((entry): entry is MemoryCandidateInput => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return false;
    }

    const value = entry as Record<string, unknown>;
    return (
      (value.scopeType === 'global' ||
        value.scopeType === 'domain' ||
        value.scopeType === 'session') &&
      typeof value.scopeId === 'string' &&
      typeof value.memoryType === 'string' &&
      typeof value.keyText === 'string' &&
      typeof value.contentText === 'string'
    );
  });
}

function createAbortError(): Error & { name: string } {
  const error = new Error('Manager run aborted') as Error & { name: string };
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  throw createAbortError();
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

function findRunningRun(projection: ManagerSessionProjection): ManagerRunRecord | null {
  return projection.activeRun?.status === 'running' ? projection.activeRun : null;
}

function findQueuedRunId(projection: ManagerSessionProjection): string | null {
  if (projection.activeRun?.status === 'queued') {
    return projection.activeRun.id;
  }

  if (projection.latestRun?.status === 'queued') {
    return projection.latestRun.id;
  }

  return null;
}

function buildSupervisorRoutingFallbackText(_language: 'zh' | 'en'): string {
  return 'Please clarify the target or domain for this request.';
}

interface InternalManagerGatewayTurnResult extends ManagerGatewayTurnResult {
  appendedBlocks: ManagerFeedBlock[];
}

async function requireMutableSessionStore(store: ManagerGatewaySessionStore): Promise<{
  appendMessage: NonNullable<ManagerGatewaySessionStore['appendMessage']>;
  updateSession: NonNullable<ManagerGatewaySessionStore['updateSession']>;
}> {
  if (!store.appendMessage || !store.updateSession) {
    throw new Error('Manager gateway submit requires a mutable session store.');
  }

  return {
    appendMessage: store.appendMessage.bind(store),
    updateSession: store.updateSession.bind(store),
  };
}

export function createManagerGateway(args: {
  sessionStore: ManagerGatewaySessionStore;
  runtimeDomainRegistry?: ManagerRuntimeDomainRegistry;
  llmPlanner?: ManagerGatewayLlmPlanner;
  summaryService?: ManagerGatewaySummaryService;
  memoryService?: ManagerGatewayMemoryService;
  contextAssembler?: ManagerGatewayContextAssembler;
  runCoordinator?: ManagerGatewayRunCoordinator;
}): ManagerGateway {
  const runtimeDomainRegistry: ManagerRuntimeDomainRegistry = args.runtimeDomainRegistry || {
    resolve: resolveRuntimeDomainPack,
    list: listRuntimeDomainPacks,
  };
  const summaryService =
    args.summaryService || createManagerSummaryService({ sessionStore: args.sessionStore });
  const memoryService =
    args.memoryService || createManagerMemoryService({ sessionStore: args.sessionStore });
  const contextAssembler =
    args.contextAssembler || createManagerContextAssembler({ summaryService, memoryService });
  const runCoordinator = args.runCoordinator || createManagerRunCoordinator();
  const childSessionBridge = createChildSessionBridge({
    sessionStore: args.sessionStore,
    runtimeDomainRegistry,
  });

  const loadSessionProjection = async (
    sessionId: string,
  ): Promise<ManagerSessionProjection | null> => {
    const session = await args.sessionStore.getSessionById(sessionId);
    if (!session) {
      return null;
    }

    const messages = await args.sessionStore.listMessages(session.id);
    const activeRun = args.sessionStore.getActiveRun
      ? await args.sessionStore.getActiveRun(session.id)
      : null;
    const latestRun = args.sessionStore.getLatestRun
      ? await args.sessionStore.getLatestRun(session.id)
      : activeRun;

    return buildSessionProjection({
      session,
      runtimeDomainRegistry,
      messages,
      activeRun,
      latestRun,
      contextAssembler,
    });
  };

  const getOrCreateMainSession = async (
    input: GetOrCreateMainSessionInput = {},
  ): Promise<ManagerSessionProjection> => {
    const runtimePack = runtimeDomainRegistry.resolve(input.domainId);
    const requestedDomainId = input.domainId || runtimePack.manifest.domainId;
    const session = await args.sessionStore.getOrCreateMainSession({
      domainId: requestedDomainId,
      runtimeDomainVersion: runtimePack.manifest.version,
      title: input.title,
      sessionKind: input.sessionKind,
    });
    const projection = await loadSessionProjection(session.id);
    if (!projection) {
      throw new Error(`Failed to load manager session projection for ${session.id}.`);
    }
    return projection;
  };

  const getSupervisorActiveItem = (
    workflow: ManagerCompositeWorkflowState | null | undefined,
  ): ManagerCompositeItem | null => {
    if (!workflow || workflow.items.length === 0 || workflow.status === 'completed') {
      return null;
    }

    if (workflow.activeItemId) {
      const activeItem = workflow.items.find((item) => item.itemId === workflow.activeItemId);
      if (activeItem) {
        return activeItem;
      }
    }

    return (
      workflow.items.find((item) => item.status === 'active') ||
      workflow.items.find((item) => item.status === 'blocked') ||
      workflow.items.find((item) => item.status === 'pending') ||
      workflow.items.find((item) => item.status === 'failed') ||
      null
    );
  };

  const persistSupervisorCompositeWorkflow = async (input: {
    sessionId: string;
    workflow: ManagerCompositeWorkflowState;
  }): Promise<ManagerSessionProjection | null> => {
    if (!args.sessionStore.updateSession) {
      throw new Error('Supervisor composite updates require a mutable session store.');
    }

    await args.sessionStore.updateSession(input.sessionId, {
      compositeWorkflowStateData: serializeCompositeWorkflow(input.workflow),
      updatedAt: input.workflow.updatedAt,
    });
    return loadSessionProjection(input.sessionId);
  };

  const syncSupervisorCompositeFromChild = async (input: {
    supervisorProjection: ManagerSessionProjection;
    childProjection: ManagerSessionProjection;
  }): Promise<ManagerSessionProjection> => {
    const workflow = input.supervisorProjection.compositeWorkflow;
    const activeItem = getSupervisorActiveItem(workflow);
    if (!workflow || !activeItem) {
      return input.supervisorProjection;
    }

    if (
      !input.childProjection.activeWorkflow &&
      input.childProjection.latestRun?.status !== 'completed'
    ) {
      return input.supervisorProjection;
    }

    const nextWorkflow = childSessionBridge.syncCompositeWorkflowFromChild({
      workflow,
      itemId: activeItem.itemId,
      childProjection: input.childProjection,
      language: 'en',
    });
    return (
      (await persistSupervisorCompositeWorkflow({
        sessionId: input.supervisorProjection.session.id,
        workflow: nextWorkflow,
      })) || input.supervisorProjection
    );
  };

  const listRoutingRuntimePacks = () => runtimeDomainRegistry.list?.() || listRuntimeDomainPacks();

  const submitDomainProjectionTurn = async (argsForTurn: {
    projection: ManagerSessionProjection;
    input: SubmitMainSessionTurnInput;
    normalized: string;
    allowHeuristicFallback: boolean;
  }): Promise<InternalManagerGatewayTurnResult> => {
    if (!argsForTurn.normalized) {
      return {
        projection: argsForTurn.projection,
        plannerMode: 'deterministic',
        diagnostics: {},
        shouldRefreshTaskState: false,
        recentMessages: mapFeedToRuntimeConversation(argsForTurn.projection.feed),
        appendedBlocks: [],
      };
    }

    const { appendMessage, updateSession } = await requireMutableSessionStore(args.sessionStore);
    const createRun = args.sessionStore.createRun?.bind(args.sessionStore);
    const updateRun = args.sessionStore.updateRun?.bind(args.sessionStore);
    const runLifecycleStore =
      createRun && updateRun
        ? {
            createRun,
            updateRun,
          }
        : null;
    const runtimePack = runtimeDomainRegistry.resolve(argsForTurn.projection.session.domainId);
    const sessionId = argsForTurn.projection.session.id;
    const reservation = runCoordinator.reserve(sessionId);
    const abortController = new AbortController();
    reservation.bindAbortController(abortController);
    const queuedAt = Date.now();
    let persistedRun: ManagerRunRecord | null = null;

    if (runLifecycleStore) {
      try {
        persistedRun = await runLifecycleStore.createRun({
          sessionId,
          status: reservation.queued ? 'queued' : 'running',
          triggerType: 'user',
          startedAt: null,
          createdAt: queuedAt,
          updatedAt: queuedAt,
        });
        reservation.bindRunId(persistedRun.id);
      } catch (error) {
        reservation.cancel();
        throw error;
      }
    }

    return reservation.run(async () => {
      const startedAt = Date.now();
      const signal = abortController.signal;
      throwIfAborted(signal);

      if (persistedRun && runLifecycleStore) {
        await runLifecycleStore.updateRun(persistedRun.id, {
          status: 'running',
          startedAt,
          updatedAt: startedAt,
        });
      }

      try {
        const userMessage = await appendMessage({
          sessionId,
          runId: persistedRun?.id || null,
          role: 'user',
          blockType: 'user_text',
          text: argsForTurn.normalized,
          createdAt: startedAt,
        });

        if (persistedRun && runLifecycleStore) {
          await runLifecycleStore.updateRun(persistedRun.id, {
            inputMessageId: userMessage.id,
            updatedAt: startedAt,
          });
        }

        const afterUserProjection = await loadSessionProjection(sessionId);
        if (!afterUserProjection) {
          throw new Error(`Failed to reload manager session ${sessionId} after appending user turn.`);
        }

        const runtimeSession = createRuntimeSessionSnapshot(afterUserProjection);
        const recentMessages = mapFeedToRuntimeConversation(afterUserProjection.feed);
        const activeWorkflow = afterUserProjection.activeWorkflow;
        let intent: AnalysisIntent | null = null;
        let assembledContext:
          | Awaited<ReturnType<ManagerGatewayContextAssembler['assemble']>>
          | null = null;
        const ensureIntentAndContext = async () => {
          throwIfAborted(signal);
          if (!assembledContext) {
            intent = await runtimePack.resolver.resolveIntent(argsForTurn.normalized, {
              language: argsForTurn.input.language,
              sessionId: runtimeSession.sessionId,
              activeDomainId: runtimeSession.domainId,
              recentMessages,
              activeWorkflow,
              signal,
            });
            throwIfAborted(signal);
            assembledContext = await contextAssembler.assemble({
              session: afterUserProjection.session,
              activeRun: afterUserProjection.activeRun,
              activeWorkflow,
              feed: afterUserProjection.feed,
              runtimePack,
              intent,
              recentMessages,
            });
            throwIfAborted(signal);
          }

          return {
            intent,
            assembledContext,
          };
        };

        let executionResult: RuntimeToolExecutionResult | WorkflowResumeResult | null = null;
        let plannerMode: ManagerGatewayTurnResult['plannerMode'] = 'deterministic';
        let toolId: string | undefined;
        let workflowType: string | undefined;
        let strictLlmAttempted = false;

        if (!executionResult && activeWorkflow && Array.isArray(runtimePack.workflows)) {
          const workflowHandler = runtimePack.workflows.find((entry) =>
            entry.canResume(activeWorkflow),
          );
          if (workflowHandler) {
            const workflowResult = await workflowHandler.resume({
              input: argsForTurn.normalized,
              language: argsForTurn.input.language,
              session: runtimeSession,
              workflow: activeWorkflow,
              signal,
            });
            throwIfAborted(signal);
            if (workflowResult.workflowHandled) {
              executionResult = workflowResult;
              plannerMode = 'workflow';
              workflowType = workflowHandler.workflowType;
            }
          }
        }

        if (!executionResult && !argsForTurn.allowHeuristicFallback) {
          if (!args.llmPlanner) {
            throw new Error('Strict manager gateway turn requires an LLM planner.');
          }
          strictLlmAttempted = true;
          const contextInput = await ensureIntentAndContext();
          const strictLlmResult = await args.llmPlanner.planTurn({
            input: argsForTurn.normalized,
            language: argsForTurn.input.language,
            requireLlm: true,
            projection: afterUserProjection,
            runtimePack,
            intent: contextInput.intent,
            contextFragments: contextInput.assembledContext.fragments,
            recentMessages,
            signal,
          });
          throwIfAborted(signal);
          if (strictLlmResult) {
            executionResult = strictLlmResult;
            plannerMode = 'llm_assisted';
          }
        }

        if (!executionResult && args.llmPlanner && !strictLlmAttempted) {
          const contextInput = await ensureIntentAndContext();
          const llmResult = await args.llmPlanner.planTurn({
            input: argsForTurn.normalized,
            language: argsForTurn.input.language,
            requireLlm: false,
            projection: afterUserProjection,
            runtimePack,
            intent: contextInput.intent,
            contextFragments: contextInput.assembledContext.fragments,
            recentMessages,
            signal,
          });
          throwIfAborted(signal);
          if (llmResult) {
            executionResult = llmResult;
            plannerMode = 'llm_assisted';
          }
        }

        if (!executionResult) {
          const contextInput = await ensureIntentAndContext();
          const tool = runtimePack.tools.find((entry) =>
            entry.canHandle({
              input: argsForTurn.normalized,
              language: argsForTurn.input.language,
              intent: contextInput.intent,
              session: runtimeSession,
              activeWorkflow,
            }),
          );

          if (!tool) {
            throw new Error(`No runtime tool could handle input for domain "${runtimeSession.domainId}".`);
          }

          executionResult = await tool.execute({
            input: argsForTurn.normalized,
            language: argsForTurn.input.language,
            intent: contextInput.intent,
            session: runtimeSession,
            activeWorkflow,
            contextFragments: contextInput.assembledContext.fragments,
            signal,
          });
          throwIfAborted(signal);
          toolId = tool.id;
        }

        let latestMessageAt = userMessage.createdAt;
        for (const block of executionResult.blocks) {
          throwIfAborted(signal);
          const record = await appendMessage({
            sessionId,
            runId: persistedRun?.id || null,
            role: mapRuntimeRole(block.role),
            blockType: mapRuntimeBlockType(block.blockType),
            text: block.text,
            payloadData: serializePayloadData(block.payload),
          });
          latestMessageAt = record.createdAt;
        }

        if (executionResult.navigationIntent) {
          throwIfAborted(signal);
          const navigationRecord = await appendMessage({
            sessionId,
            runId: persistedRun?.id || null,
            role: 'system',
            blockType: 'navigation_intent',
            payloadData: JSON.stringify(executionResult.navigationIntent),
          });
          latestMessageAt = navigationRecord.createdAt;
        }

        if (Array.isArray(executionResult.memoryWrites) && executionResult.memoryWrites.length > 0) {
          throwIfAborted(signal);
          await memoryService.persistMemoryWrites({
            session: runtimeSession,
            runtimePack,
            writes: executionResult.memoryWrites,
          });
        }

        const memoryCandidates = extractMemoryCandidates(executionResult);
        if (memoryCandidates.length > 0) {
          throwIfAborted(signal);
          await persistMemoryCandidates({
            candidates: memoryCandidates,
            sessionStore: args.sessionStore,
          });
        }

        const persistedMessages = await args.sessionStore.listMessages(sessionId);
        const latestSummary = await summaryService.refreshSessionSummary({
          sessionId,
          messages: persistedMessages,
        });

        await updateSession(sessionId, {
          title: executionResult.sessionPatch?.title,
          runtimeDomainVersion: runtimePack.manifest.version,
          activeWorkflowType: executionResult.sessionPatch?.activeWorkflow?.workflowType ?? null,
          activeWorkflowStateData: executionResult.sessionPatch?.activeWorkflow
            ? JSON.stringify(executionResult.sessionPatch.activeWorkflow.stateData)
            : null,
          latestSummaryId:
            latestSummary?.id ?? afterUserProjection.session.latestSummaryId ?? null,
          latestMessageAt,
        });

        if (persistedRun && runLifecycleStore) {
          const completedAt = Date.now();
          await runLifecycleStore.updateRun(persistedRun.id, {
            status: 'completed',
            plannerMode,
            intentType: intent?.intentType || null,
            toolPath: workflowType ? `workflow:${workflowType}` : toolId || null,
            errorCode: null,
            errorMessage: null,
            finishedAt: completedAt,
            updatedAt: completedAt,
          });
        }

        const nextProjection = await loadSessionProjection(sessionId);
        if (!nextProjection) {
          throw new Error(`Failed to reload manager session ${sessionId} after executing turn.`);
        }

        return {
          projection: nextProjection,
          plannerMode,
          toolId,
          workflowType,
          diagnostics: withOrchestrationDiagnostics({
            diagnostics: executionResult.diagnostics,
            orchestration: {
              migration: buildGatewayMigrationDiagnostics(
                argsForTurn.projection.session.sessionKind,
              ),
            },
          }),
          feedbackMessage: extractFeedbackMessage(executionResult),
          shouldRefreshTaskState: extractShouldRefreshTaskState(executionResult),
          navigationIntent: executionResult.navigationIntent,
          recentMessages: mapFeedToRuntimeConversation(nextProjection.feed),
          appendedBlocks: nextProjection.feed.slice(afterUserProjection.feed.length),
        };
      } catch (error) {
        if (persistedRun && runLifecycleStore) {
          const cancelledByUser = signal.aborted || isAbortError(error);
          const finishedAt = Date.now();
          await runLifecycleStore.updateRun(persistedRun.id, {
            status: cancelledByUser ? 'cancelled' : 'failed',
            errorCode: cancelledByUser ? 'aborted_by_user' : 'submit_failed',
            errorMessage: cancelledByUser
              ? 'Interrupted by user.'
              : error instanceof Error
                ? error.message
                : String(error),
            finishedAt,
            updatedAt: finishedAt,
          });
        }
        throw error;
      }
    });
  };

  const submitSupervisorProjectionTurn = async (argsForTurn: {
    projection: ManagerSessionProjection;
    input: SubmitMainSessionTurnInput;
    normalized: string;
    allowHeuristicFallback: boolean;
  }): Promise<InternalManagerGatewayTurnResult> => {
    if (!argsForTurn.normalized) {
      return {
        projection: argsForTurn.projection,
        plannerMode: 'deterministic',
        diagnostics: {},
        shouldRefreshTaskState: false,
        recentMessages: mapFeedToRuntimeConversation(argsForTurn.projection.feed),
        appendedBlocks: [],
      };
    }

    const { appendMessage, updateSession } = await requireMutableSessionStore(args.sessionStore);
    const createRun = args.sessionStore.createRun?.bind(args.sessionStore);
    const updateRun = args.sessionStore.updateRun?.bind(args.sessionStore);
    const runLifecycleStore =
      createRun && updateRun
        ? {
            createRun,
            updateRun,
          }
        : null;
    const sessionId = argsForTurn.projection.session.id;
    const reservation = runCoordinator.reserve(sessionId);
    const abortController = new AbortController();
    reservation.bindAbortController(abortController);
    const queuedAt = Date.now();
    let persistedRun: ManagerRunRecord | null = null;

    if (runLifecycleStore) {
      try {
        persistedRun = await runLifecycleStore.createRun({
          sessionId,
          status: reservation.queued ? 'queued' : 'running',
          triggerType: 'user',
          startedAt: null,
          createdAt: queuedAt,
          updatedAt: queuedAt,
        });
        reservation.bindRunId(persistedRun.id);
      } catch (error) {
        reservation.cancel();
        throw error;
      }
    }

    return reservation.run(async () => {
      const startedAt = Date.now();
      const signal = abortController.signal;
      throwIfAborted(signal);

      if (persistedRun && runLifecycleStore) {
        await runLifecycleStore.updateRun(persistedRun.id, {
          status: 'running',
          startedAt,
          updatedAt: startedAt,
        });
      }

      try {
        const userMessage = await appendMessage({
          sessionId,
          runId: persistedRun?.id || null,
          role: 'user',
          blockType: 'user_text',
          text: argsForTurn.normalized,
          createdAt: startedAt,
        });

        if (persistedRun && runLifecycleStore) {
          await runLifecycleStore.updateRun(persistedRun.id, {
            inputMessageId: userMessage.id,
            updatedAt: startedAt,
          });
        }

        const afterUserProjection = await loadSessionProjection(sessionId);
        if (!afterUserProjection) {
          throw new Error(`Failed to reload manager session ${sessionId} after appending user turn.`);
        }

        let compositeWorkflow = afterUserProjection.compositeWorkflow;
        let activeItem =
          compositeWorkflow?.activeItemId
            ? compositeWorkflow.items.find((item) => item.itemId === compositeWorkflow.activeItemId) ||
              null
            : null;
        let childInput = argsForTurn.normalized;
        let routingResultForDiagnostics: ManagerRoutingResult | null = null;
        let childInputSource: 'source_text' | 'user_input' = 'user_input';

        if (!compositeWorkflow || compositeWorkflow.status === 'completed' || !activeItem) {
          const routingResult = await resolveRuntimeManagerRoutingResult({
            input: argsForTurn.normalized,
            language: argsForTurn.input.language,
            runtimePacks: listRoutingRuntimePacks(),
            sessionId,
            activeDomainId: argsForTurn.input.domainId || afterUserProjection.session.domainId,
            recentMessages: mapFeedToRuntimeConversation(afterUserProjection.feed),
            signal,
          });
          throwIfAborted(signal);
          routingResultForDiagnostics = routingResult;

          if (routingResult.mode === 'ambiguous' || routingResult.items.length === 0) {
            const feedbackMessage = buildSupervisorRoutingFallbackText(argsForTurn.input.language);
            const assistantRecord = await appendMessage({
              sessionId,
              runId: persistedRun?.id || null,
              role: 'assistant',
              blockType: 'assistant_text',
              text: feedbackMessage,
            });
            const persistedMessages = await args.sessionStore.listMessages(sessionId);
            const latestSummary = await summaryService.refreshSessionSummary({
              sessionId,
              messages: persistedMessages,
            });
            await updateSession(sessionId, {
              runtimeDomainVersion: runtimeDomainRegistry.resolve(
                afterUserProjection.session.domainId,
              ).manifest.version,
              latestSummaryId:
                latestSummary?.id ?? afterUserProjection.session.latestSummaryId ?? null,
              latestMessageAt: assistantRecord.createdAt,
            });

            if (persistedRun && runLifecycleStore) {
              const completedAt = Date.now();
              await runLifecycleStore.updateRun(persistedRun.id, {
                status: 'completed',
                plannerMode: 'deterministic',
                intentType: 'ambiguous',
                toolPath: 'supervisor:routing',
                errorCode: null,
                errorMessage: null,
                finishedAt: completedAt,
                updatedAt: completedAt,
              });
            }

            const nextProjection = await loadSessionProjection(sessionId);
            if (!nextProjection) {
              throw new Error(`Failed to reload supervisor session ${sessionId} after routing fallback.`);
            }

            return {
              projection: nextProjection,
              plannerMode: 'deterministic',
              diagnostics: withOrchestrationDiagnostics({
                diagnostics: {
                  routingResult,
                },
                orchestration: {
                  migration: buildGatewayMigrationDiagnostics(
                    afterUserProjection.session.sessionKind,
                  ),
                  routing: buildGatewayRoutingDiagnostics(routingResult),
                },
              }),
              feedbackMessage,
              shouldRefreshTaskState: false,
              recentMessages: mapFeedToRuntimeConversation(nextProjection.feed),
              appendedBlocks: nextProjection.feed.slice(afterUserProjection.feed.length),
            };
          }

          compositeWorkflow = createCompositeWorkflow({
            sourceText: argsForTurn.normalized,
            routingResult,
          });
          await updateSession(sessionId, {
            compositeWorkflowStateData: serializeCompositeWorkflow(compositeWorkflow),
          });
          activeItem =
            compositeWorkflow.items.find((item) => item.itemId === compositeWorkflow.activeItemId) ||
            null;
          childInput = activeItem?.sourceText || argsForTurn.normalized;
          childInputSource = 'source_text';
        } else {
          childInput = activeItem.childSessionId ? argsForTurn.normalized : activeItem.sourceText;
          childInputSource = activeItem.childSessionId ? 'user_input' : 'source_text';
        }

        if (!compositeWorkflow || !activeItem) {
          throw new Error(`Supervisor session ${sessionId} has no active composite item to dispatch.`);
        }

        const childSession = await childSessionBridge.ensureChildSession({
          supervisorSession: afterUserProjection.session,
          item: activeItem,
        });
        const childProjection = await loadSessionProjection(childSession.id);
        if (!childProjection) {
          throw new Error(`Failed to load child session projection ${childSession.id}.`);
        }

        compositeWorkflow = syncChildStateIntoCompositeItem(compositeWorkflow, {
          itemId: activeItem.itemId,
          status: 'active',
          childSessionId: childSession.id,
          childWorkflowType:
            childProjection.activeWorkflow?.workflowType || activeItem.childWorkflowType || null,
          childWorkflowStateData:
            childProjection.activeWorkflow?.stateData || activeItem.childWorkflowStateData || null,
          pendingLabel: activeItem.pendingLabel,
          summary: activeItem.summary,
        });
        await updateSession(sessionId, {
          compositeWorkflowStateData: serializeCompositeWorkflow(compositeWorkflow),
        });
        activeItem =
          compositeWorkflow.items.find((item) => item.itemId === activeItem!.itemId) || activeItem;

        const childResult = await submitDomainProjectionTurn({
          projection: childProjection,
          input: {
            ...argsForTurn.input,
            input: childInput,
            domainId: activeItem.domainId,
            title: activeItem.title,
          },
          normalized: childInput,
          allowHeuristicFallback: argsForTurn.allowHeuristicFallback,
        });

        let latestMessageAt = userMessage.createdAt;
        for (const block of childResult.appendedBlocks) {
          const record = await appendMessage({
            sessionId,
            runId: persistedRun?.id || null,
            role: block.role,
            blockType: block.blockType,
            text: block.text,
            payloadData: block.payloadData,
          });
          latestMessageAt = record.createdAt;
        }

        const nextCompositeWorkflow = childSessionBridge.syncCompositeWorkflowFromChild({
          workflow: compositeWorkflow,
          itemId: activeItem.itemId,
          childProjection: childResult.projection,
          language: argsForTurn.input.language,
        });
        const childSyncDiagnostics =
          buildGatewayChildSyncDiagnostics({
            workflow: nextCompositeWorkflow,
            itemId: activeItem.itemId,
            outcome: childResult.projection.activeWorkflow
              ? 'workflow_active'
              : 'item_completed',
          }) || undefined;
        const persistedMessages = await args.sessionStore.listMessages(sessionId);
        const latestSummary = await summaryService.refreshSessionSummary({
          sessionId,
          messages: persistedMessages,
        });
        await updateSession(sessionId, {
          title: argsForTurn.input.title ?? afterUserProjection.session.title,
          runtimeDomainVersion: runtimeDomainRegistry.resolve(
            afterUserProjection.session.domainId,
          ).manifest.version,
          compositeWorkflowStateData: serializeCompositeWorkflow(nextCompositeWorkflow),
          latestSummaryId:
            latestSummary?.id ?? afterUserProjection.session.latestSummaryId ?? null,
          latestMessageAt,
        });

        if (persistedRun && runLifecycleStore) {
          const completedAt = Date.now();
          await runLifecycleStore.updateRun(persistedRun.id, {
            status: 'completed',
            plannerMode: childResult.plannerMode,
            intentType: nextCompositeWorkflow.items.length > 1 ? 'composite' : 'single',
            toolPath: childResult.workflowType
              ? `supervisor:workflow:${childResult.workflowType}`
              : childResult.toolId
                ? `supervisor:${childResult.toolId}`
                : 'supervisor:child_dispatch',
            errorCode: null,
            errorMessage: null,
            finishedAt: completedAt,
            updatedAt: completedAt,
          });
        }

        const nextProjection = await loadSessionProjection(sessionId);
        if (!nextProjection) {
          throw new Error(`Failed to reload supervisor session ${sessionId} after child dispatch.`);
        }

        return {
          projection: nextProjection,
          plannerMode: childResult.plannerMode,
          toolId: childResult.toolId,
          workflowType: childResult.workflowType,
          diagnostics: withOrchestrationDiagnostics({
            diagnostics: childResult.diagnostics,
            orchestration: {
              migration: buildGatewayMigrationDiagnostics(
                afterUserProjection.session.sessionKind,
              ),
              ...(routingResultForDiagnostics
                ? {
                    routing: buildGatewayRoutingDiagnostics(routingResultForDiagnostics),
                  }
                : {}),
              activeChild: buildGatewayActiveChildDiagnostics({
                item: activeItem,
                childSessionId: childSession.id,
                inputSource: childInputSource,
              }),
              ...(childSyncDiagnostics
                ? {
                    childSync: childSyncDiagnostics,
                  }
                : {}),
            },
          }),
          feedbackMessage: childResult.feedbackMessage,
          shouldRefreshTaskState: childResult.shouldRefreshTaskState,
          navigationIntent: childResult.navigationIntent,
          recentMessages: mapFeedToRuntimeConversation(nextProjection.feed),
          appendedBlocks: nextProjection.feed.slice(afterUserProjection.feed.length),
        };
      } catch (error) {
        if (persistedRun && runLifecycleStore) {
          const cancelledByUser = signal.aborted || isAbortError(error);
          const finishedAt = Date.now();
          await runLifecycleStore.updateRun(persistedRun.id, {
            status: cancelledByUser ? 'cancelled' : 'failed',
            errorCode: cancelledByUser ? 'aborted_by_user' : 'submit_failed',
            errorMessage: cancelledByUser
              ? 'Interrupted by user.'
              : error instanceof Error
                ? error.message
                : String(error),
            finishedAt,
            updatedAt: finishedAt,
          });
        }
        throw error;
      }
    });
  };

  const cancelSessionRunInternal = async (
    sessionId: string,
    input?: {
      mode?: 'auto' | 'running' | 'queued';
    },
  ): Promise<ManagerGatewayRunCancelResult> => {
    const projection = await loadSessionProjection(sessionId);
    if (!projection) {
      throw new Error(`Manager session "${sessionId}" was not found.`);
    }

    const mode = input?.mode || 'auto';
    const updateRun = args.sessionStore.updateRun?.bind(args.sessionStore);

    const interruptRunningRun = async (
      currentProjection: ManagerSessionProjection,
    ): Promise<ManagerGatewayRunCancelResult | null> => {
      const runningRun = findRunningRun(currentProjection);
      if (!runningRun) {
        return null;
      }

      const interruptOutcome = runCoordinator.cancelRun(runningRun.id);
      if (interruptOutcome === 'aborting') {
        const nextProjection = (await loadSessionProjection(sessionId)) || currentProjection;
        return {
          projection: nextProjection,
          outcome: 'interrupt_requested',
          runId: runningRun.id,
          feedbackMessage: 'Interrupt requested for the active manager run.',
        };
      }

      if (interruptOutcome === 'cancelled') {
        const cancelledAt = Date.now();
        if (updateRun) {
          await updateRun(runningRun.id, {
            status: 'cancelled',
            errorCode: 'cancelled_by_user',
            errorMessage: 'Cancelled before execution.',
            finishedAt: cancelledAt,
            updatedAt: cancelledAt,
          });
        }

        const nextProjection = (await loadSessionProjection(sessionId)) || currentProjection;
        return {
          projection: nextProjection,
          outcome: 'cancelled',
          runId: runningRun.id,
          feedbackMessage: 'Queued manager turn cancelled before execution.',
        };
      }

      return {
        projection: currentProjection,
        outcome: 'not_supported',
        runId: runningRun.id,
        feedbackMessage: 'The active manager run could not be interrupted from this process.',
      };
    };

    const cancelQueuedRun = async (
      currentProjection: ManagerSessionProjection,
    ): Promise<ManagerGatewayRunCancelResult | null> => {
      const queuedRunIdFromCoordinator = runCoordinator.cancelLatestQueuedRun(sessionId);
      const queuedRunId = queuedRunIdFromCoordinator || findQueuedRunId(currentProjection);
      if (!queuedRunId) {
        return null;
      }

      const cancelledAt = Date.now();
      if (updateRun) {
        await updateRun(queuedRunId, {
          status: 'cancelled',
          errorCode: 'cancelled_by_user',
          errorMessage: 'Cancelled before execution.',
          finishedAt: cancelledAt,
          updatedAt: cancelledAt,
        });
      }

      const nextProjection = (await loadSessionProjection(sessionId)) || currentProjection;
      return {
        projection: nextProjection,
        outcome: 'cancelled',
        runId: queuedRunId,
        feedbackMessage: 'Queued manager turn cancelled before execution.',
      };
    };

    if (projection.session.sessionKind === 'supervisor') {
      const activeItem = getSupervisorActiveItem(projection.compositeWorkflow);
      if (activeItem?.childSessionId) {
        const childProjection = await loadSessionProjection(activeItem.childSessionId);
        if (childProjection) {
          const childHasCancelableRun =
            (mode !== 'queued' && Boolean(findRunningRun(childProjection))) ||
            Boolean(findQueuedRunId(childProjection));

          if (childHasCancelableRun) {
            const childCancelResult = await cancelSessionRunInternal(activeItem.childSessionId, input);
            const latestChildProjection =
              (await loadSessionProjection(activeItem.childSessionId)) || childCancelResult.projection;
            let nextSupervisorProjection =
              (await loadSessionProjection(sessionId)) || projection;
            nextSupervisorProjection = await syncSupervisorCompositeFromChild({
              supervisorProjection: nextSupervisorProjection,
              childProjection: latestChildProjection,
            });

            if (mode === 'running') {
              const runningResult = await interruptRunningRun(nextSupervisorProjection);
              if (runningResult) {
                return {
                  ...runningResult,
                  projection: (await loadSessionProjection(sessionId)) || runningResult.projection,
                };
              }
            }

            const queuedResult = await cancelQueuedRun(
              (await loadSessionProjection(sessionId)) || nextSupervisorProjection,
            );
            if (queuedResult) {
              return queuedResult;
            }

            if (mode !== 'queued') {
              const runningResult = await interruptRunningRun(
                (await loadSessionProjection(sessionId)) || nextSupervisorProjection,
              );
              if (runningResult) {
                return runningResult;
              }
            }

            return {
              projection: (await loadSessionProjection(sessionId)) || nextSupervisorProjection,
              outcome: childCancelResult.outcome,
              runId: childCancelResult.runId,
              feedbackMessage: childCancelResult.feedbackMessage,
            };
          }
        }
      }
    }

    if (mode === 'running') {
      const runningResult = await interruptRunningRun(projection);
      if (runningResult) {
        return runningResult;
      }
    }

    const queuedResult = await cancelQueuedRun(projection);
    if (queuedResult) {
      return queuedResult;
    }

    if (mode !== 'queued') {
      const runningResult = await interruptRunningRun((await loadSessionProjection(sessionId)) || projection);
      if (runningResult) {
        return runningResult;
      }
    }

    if (
      projection.session.sessionKind === 'supervisor' &&
      projection.compositeWorkflow &&
      projection.compositeWorkflow.status !== 'completed'
    ) {
      const nextWorkflow = cancelCompositeWorkflow(projection.compositeWorkflow, {
        now: Date.now(),
      });
      const nextProjection = await persistSupervisorCompositeWorkflow({
        sessionId,
        workflow: nextWorkflow,
      });
      return {
        projection: nextProjection || projection,
        outcome: 'cancelled',
        feedbackMessage: 'Supervisor workflow cancelled.',
      };
    }

    return {
      projection,
      outcome: 'noop',
      feedbackMessage: 'No queued or running manager run is available to cancel.',
    };
  };

  return {
    async getOrCreateMainSession(
      input: GetOrCreateMainSessionInput = {},
    ): Promise<ManagerSessionProjection> {
      return getOrCreateMainSession(input);
    },

    async loadSessionProjection(sessionId: string): Promise<ManagerSessionProjection | null> {
      return loadSessionProjection(sessionId);
    },

    async submitMainSessionTurn(
      input: SubmitMainSessionTurnInput,
    ): Promise<ManagerGatewayTurnResult> {
      const normalized = input.input.trim();
      const allowHeuristicFallback = input.allowHeuristicFallback !== false;
      const projection = await getOrCreateMainSession({
        domainId: input.domainId,
        title: input.title,
        sessionKind: input.sessionKind,
      });

      if (projection.session.sessionKind === 'supervisor') {
        return submitSupervisorProjectionTurn({
          projection,
          input,
          normalized,
          allowHeuristicFallback,
        });
      }

      return submitDomainProjectionTurn({
        projection,
        input,
        normalized,
        allowHeuristicFallback,
      });
    },

    async cancelSessionRun(
      sessionId: string,
      input?: {
        mode?: 'auto' | 'running' | 'queued';
      },
    ): Promise<ManagerGatewayRunCancelResult> {
      return cancelSessionRunInternal(sessionId, input);
    },
  };
}
