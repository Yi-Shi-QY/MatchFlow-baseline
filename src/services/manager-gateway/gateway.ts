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
  resolveRuntimeDomainPack,
} from '@/src/domains/runtime/registry';
import type { MemoryCandidateInput } from '@/src/services/memoryCandidateTypes';
import { persistMemoryCandidates } from '@/src/services/memoryCandidateStore';
import { createManagerContextAssembler } from './contextAssembler';
import { createManagerMemoryService } from './memoryService';
import { createManagerRunCoordinator } from './runCoordinator';
import { createManagerSummaryService } from './summaryService';
import type {
  GetOrCreateMainSessionInput,
  ManagerFeedBlock,
  ManagerGatewayContextAssembler,
  ManagerGateway,
  ManagerGatewayLlmPlanner,
  ManagerGatewayMemoryService,
  ManagerGatewayRunCancelResult,
  ManagerGatewayRunCoordinator,
  ManagerGatewaySummaryService,
  ManagerGatewayTurnResult,
  ManagerGatewaySessionStore,
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

function projectFeed(messages: Awaited<ReturnType<ManagerGatewaySessionStore['listMessages']>>): ManagerFeedBlock[] {
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
    activeWorkflow: parseActiveWorkflow(args.session),
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
  };
  const summaryService =
    args.summaryService || createManagerSummaryService({ sessionStore: args.sessionStore });
  const memoryService =
    args.memoryService || createManagerMemoryService({ sessionStore: args.sessionStore });
  const contextAssembler =
    args.contextAssembler || createManagerContextAssembler({ summaryService, memoryService });
  const runCoordinator = args.runCoordinator || createManagerRunCoordinator();

  return {
    async getOrCreateMainSession(
      input: GetOrCreateMainSessionInput = {},
    ): Promise<ManagerSessionProjection> {
      const runtimePack = runtimeDomainRegistry.resolve(input.domainId);
      const requestedDomainId = input.domainId || runtimePack.manifest.domainId;
      const session = await args.sessionStore.getOrCreateMainSession({
        domainId: requestedDomainId,
        runtimeDomainVersion: runtimePack.manifest.version,
        title: input.title,
      });
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
    },

    async loadSessionProjection(sessionId: string): Promise<ManagerSessionProjection | null> {
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
    },

    async submitMainSessionTurn(
      input: SubmitMainSessionTurnInput,
    ): Promise<ManagerGatewayTurnResult> {
      const normalized = input.input.trim();
      const allowHeuristicFallback = input.allowHeuristicFallback !== false;
      const projection = await this.getOrCreateMainSession({
        domainId: input.domainId,
        title: input.title,
      });

      if (!normalized) {
        return {
          projection,
          plannerMode: 'deterministic',
          diagnostics: {},
          shouldRefreshTaskState: false,
          recentMessages: mapFeedToRuntimeConversation(projection.feed),
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
      const runtimePack = runtimeDomainRegistry.resolve(projection.session.domainId);
      const sessionId = projection.session.id;
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
          throwIfAborted(signal);
          const userMessage = await appendMessage({
            sessionId,
            runId: persistedRun?.id || null,
            role: 'user',
            blockType: 'user_text',
            text: normalized,
            createdAt: startedAt,
          });
          throwIfAborted(signal);
          if (persistedRun && runLifecycleStore) {
            await runLifecycleStore.updateRun(persistedRun.id, {
              inputMessageId: userMessage.id,
              updatedAt: startedAt,
            });
          }

          const afterUserProjection = await this.loadSessionProjection(sessionId);
          if (!afterUserProjection) {
            throw new Error(`Failed to reload manager session ${sessionId} after appending user turn.`);
          }
          throwIfAborted(signal);

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
              intent = await runtimePack.resolver.resolveIntent(normalized, {
                language: input.language,
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
            const workflowHandler = runtimePack.workflows.find((entry) => entry.canResume(activeWorkflow));
            if (workflowHandler) {
              const workflowResult = await workflowHandler.resume({
                input: normalized,
                language: input.language,
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

          if (!executionResult && !allowHeuristicFallback) {
            if (!args.llmPlanner) {
              throw new Error('Strict manager gateway turn requires an LLM planner.');
            }
            strictLlmAttempted = true;
            const contextInput = await ensureIntentAndContext();
            const strictLlmResult = await args.llmPlanner.planTurn({
              input: normalized,
              language: input.language,
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
              input: normalized,
              language: input.language,
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
                input: normalized,
                language: input.language,
                intent: contextInput.intent,
                session: runtimeSession,
                activeWorkflow,
              }),
            );

            if (!tool) {
              throw new Error(`No runtime tool could handle input for domain "${runtimeSession.domainId}".`);
            }

            executionResult = await tool.execute({
              input: normalized,
              language: input.language,
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

          throwIfAborted(signal);
          const persistedMessages = await args.sessionStore.listMessages(sessionId);
          const latestSummary = await summaryService.refreshSessionSummary({
            sessionId,
            messages: persistedMessages,
          });

          throwIfAborted(signal);
          await updateSession(sessionId, {
            title: executionResult.sessionPatch?.title,
            runtimeDomainVersion: runtimePack.manifest.version,
            activeWorkflowType: executionResult.sessionPatch?.activeWorkflow?.workflowType ?? null,
            activeWorkflowStateData: executionResult.sessionPatch?.activeWorkflow
              ? JSON.stringify(executionResult.sessionPatch.activeWorkflow.stateData)
              : null,
            latestSummaryId: latestSummary?.id ?? afterUserProjection.session.latestSummaryId ?? null,
            latestMessageAt,
          });

          if (persistedRun && runLifecycleStore) {
            throwIfAborted(signal);
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

          const nextProjection = await this.loadSessionProjection(sessionId);
          if (!nextProjection) {
            throw new Error(`Failed to reload manager session ${sessionId} after executing turn.`);
          }

          return {
            projection: nextProjection,
            plannerMode,
            toolId,
            workflowType,
            diagnostics: executionResult.diagnostics,
            feedbackMessage: extractFeedbackMessage(executionResult),
            shouldRefreshTaskState: extractShouldRefreshTaskState(executionResult),
            navigationIntent: executionResult.navigationIntent,
            recentMessages: mapFeedToRuntimeConversation(nextProjection.feed),
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
    },

    async cancelSessionRun(
      sessionId: string,
      input?: {
        mode?: 'auto' | 'running' | 'queued';
      },
    ): Promise<ManagerGatewayRunCancelResult> {
      const projection = await this.loadSessionProjection(sessionId);
      if (!projection) {
        throw new Error(`Manager session "${sessionId}" was not found.`);
      }

      const runningRun = findRunningRun(projection);
      const mode = input?.mode || 'auto';

      const interruptRunningRun = async (): Promise<ManagerGatewayRunCancelResult | null> => {
        if (!runningRun) {
          return null;
        }

        const interruptOutcome = runCoordinator.cancelRun(runningRun.id);
        if (interruptOutcome === 'aborting') {
          const nextProjection = (await this.loadSessionProjection(sessionId)) || projection;
          return {
            projection: nextProjection,
            outcome: 'interrupt_requested',
            runId: runningRun.id,
            feedbackMessage: 'Interrupt requested for the active manager run.',
          };
        }

        if (interruptOutcome === 'cancelled') {
          const updateRun = args.sessionStore.updateRun?.bind(args.sessionStore);
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

          const nextProjection = (await this.loadSessionProjection(sessionId)) || projection;
          return {
            projection: nextProjection,
            outcome: 'cancelled',
            runId: runningRun.id,
            feedbackMessage: 'Queued manager turn cancelled before execution.',
          };
        }

        return {
          projection,
          outcome: 'not_supported',
          runId: runningRun.id,
          feedbackMessage: 'The active manager run could not be interrupted from this process.',
        };
      };

      if (mode === 'running') {
        const runningResult = await interruptRunningRun();
        if (runningResult) {
          return runningResult;
        }
      }

      const queuedRunIdFromCoordinator = runCoordinator.cancelLatestQueuedRun(sessionId);
      const queuedRunId = queuedRunIdFromCoordinator || findQueuedRunId(projection);

      if (queuedRunId) {
        const updateRun = args.sessionStore.updateRun?.bind(args.sessionStore);
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

        const nextProjection = (await this.loadSessionProjection(sessionId)) || projection;
        return {
          projection: nextProjection,
          outcome: 'cancelled',
          runId: queuedRunId,
          feedbackMessage: 'Queued manager turn cancelled before execution.',
        };
      }

      if (mode !== 'queued') {
        const runningResult = await interruptRunningRun();
        if (runningResult) {
          return runningResult;
        }
      }

      return {
        projection,
        outcome: 'noop',
        feedbackMessage: 'No queued or running manager run is available to cancel.',
      };
    },
  };
}
