import type {
  AnalysisIntent,
  ContextFragment,
  DomainRuntimePack,
  MemoryWriteRequest,
  RuntimeConversationTurn,
  RuntimeMemoryScopeType,
  RuntimeSessionSnapshot,
  RuntimeToolExecutionResult,
  SessionWorkflowStateSnapshot,
} from '@/src/domains/runtime/types';

export type ManagerLanguage = 'zh' | 'en';
export type ManagerSessionStatus = 'active' | 'archived';
export type ManagerRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ManagerMessageRole = 'user' | 'assistant' | 'system';
export type ManagerMessageBlockType =
  | 'user_text'
  | 'assistant_text'
  | 'tool_status'
  | 'tool_result'
  | 'draft_bundle'
  | 'approval_request'
  | 'navigation_intent'
  | 'error_notice'
  | 'context_notice';

export interface ManagerSessionRecord {
  id: string;
  sessionKey: string;
  title: string;
  status: ManagerSessionStatus;
  domainId: string;
  runtimeDomainVersion?: string | null;
  activeWorkflowType?: string | null;
  activeWorkflowStateData?: string | null;
  latestSummaryId?: string | null;
  latestMessageAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface ManagerMessageRecord {
  id: string;
  sessionId: string;
  runId?: string | null;
  ordinal: number;
  role: ManagerMessageRole;
  blockType: ManagerMessageBlockType;
  text?: string | null;
  payloadData?: string | null;
  createdAt: number;
}

export interface ManagerRunRecord {
  id: string;
  sessionId: string;
  inputMessageId?: string | null;
  status: ManagerRunStatus;
  triggerType: 'user' | 'system' | 'resume' | 'compaction';
  plannerMode?: 'deterministic' | 'workflow' | 'llm_assisted' | null;
  intentType?: string | null;
  toolPath?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  stateData?: string | null;
  startedAt?: number | null;
  finishedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ManagerSummaryRecord {
  id: string;
  sessionId: string;
  kind: string;
  cutoffOrdinal: number;
  summaryText: string;
  sourceMessageCount: number;
  createdAt: number;
}

export interface ManagerMemoryRecord {
  id: string;
  scopeType: RuntimeMemoryScopeType;
  scopeId: string;
  memoryType: string;
  keyText: string;
  contentText: string;
  importance?: number | null;
  source?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ManagerFeedBlock {
  id: string;
  role: ManagerMessageRole;
  blockType: ManagerMessageBlockType;
  text?: string | null;
  payloadData?: string | null;
  createdAt: number;
}

export interface ContextUsageSnapshot {
  fragmentCount: number;
  tokenEstimate?: number;
  summaryId?: string | null;
  memoryCount?: number;
}

export interface ManagerContextSnapshot {
  assembledAt: number;
  fragments: ContextFragment[];
  recentMessageCount: number;
  summaryId?: string | null;
  memoryCount: number;
}

export interface ManagerSessionProjection {
  session: ManagerSessionRecord;
  runtimeDomainId: string;
  runtimeDomainVersion: string;
  feed: ManagerFeedBlock[];
  activeRun: ManagerRunRecord | null;
  latestRun: ManagerRunRecord | null;
  activeWorkflow: SessionWorkflowStateSnapshot | null;
  contextUsage?: ContextUsageSnapshot;
  contextSnapshot?: ManagerContextSnapshot;
}

export interface ManagerGatewayRunCancelResult {
  projection: ManagerSessionProjection;
  outcome: 'cancelled' | 'interrupt_requested' | 'not_supported' | 'noop';
  runId?: string;
  feedbackMessage?: string;
}

export interface GetOrCreateMainSessionInput {
  domainId?: string;
  title?: string;
}

export interface SubmitMainSessionTurnInput {
  input: string;
  language: ManagerLanguage;
  domainId?: string;
  title?: string;
  allowHeuristicFallback?: boolean;
}

export interface ManagerGatewayTurnResult {
  projection: ManagerSessionProjection;
  plannerMode: 'workflow' | 'deterministic' | 'llm_assisted';
  toolId?: string;
  workflowType?: string;
  diagnostics?: Record<string, unknown>;
  feedbackMessage?: string;
  shouldRefreshTaskState: boolean;
  navigationIntent?: {
    route: string;
    state?: Record<string, unknown>;
  };
  recentMessages: RuntimeConversationTurn[];
}

export interface ManagerGatewayLlmPlanner {
  planTurn(input: {
    input: string;
    language: ManagerLanguage;
    requireLlm: boolean;
    projection: ManagerSessionProjection;
    runtimePack: DomainRuntimePack;
    intent?: AnalysisIntent | null;
    contextFragments?: ContextFragment[];
    recentMessages: RuntimeConversationTurn[];
    signal?: AbortSignal;
  }): Promise<RuntimeToolExecutionResult | null>;
}

export interface ManagerGatewaySessionStore {
  getOrCreateMainSession(input: {
    domainId: string;
    runtimeDomainVersion?: string | null;
    title?: string;
  }): Promise<ManagerSessionRecord>;
  getSessionById(sessionId: string): Promise<ManagerSessionRecord | null>;
  listMessages(sessionId: string): Promise<ManagerMessageRecord[]>;
  getLatestSummary?(sessionId: string): Promise<ManagerSummaryRecord | null>;
  saveSummary?(input: {
    sessionId: string;
    kind: string;
    cutoffOrdinal: number;
    summaryText: string;
    sourceMessageCount: number;
    createdAt?: number;
  }): Promise<ManagerSummaryRecord>;
  listMemories?(input: {
    scopeType: RuntimeMemoryScopeType;
    scopeId: string;
    limit?: number;
  }): Promise<ManagerMemoryRecord[]>;
  upsertMemory?(input: {
    scopeType: RuntimeMemoryScopeType;
    scopeId: string;
    memoryType: string;
    keyText: string;
    contentText: string;
    importance?: number | null;
    source?: string | null;
    createdAt?: number;
    updatedAt?: number;
  }): Promise<ManagerMemoryRecord>;
  appendMessage?(input: {
    sessionId: string;
    runId?: string | null;
    role: ManagerMessageRole;
    blockType: ManagerMessageBlockType;
    text?: string | null;
    payloadData?: string | null;
    createdAt?: number;
  }): Promise<ManagerMessageRecord>;
  createRun?(input: {
    sessionId: string;
    inputMessageId?: string | null;
    status: ManagerRunStatus;
    triggerType: ManagerRunRecord['triggerType'];
    plannerMode?: ManagerRunRecord['plannerMode'];
    intentType?: string | null;
    toolPath?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    stateData?: string | null;
    startedAt?: number | null;
    finishedAt?: number | null;
    createdAt?: number;
    updatedAt?: number;
  }): Promise<ManagerRunRecord>;
  updateRun?(runId: string, patch: {
    inputMessageId?: string | null;
    status?: ManagerRunStatus;
    plannerMode?: ManagerRunRecord['plannerMode'];
    intentType?: string | null;
    toolPath?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    stateData?: string | null;
    startedAt?: number | null;
    finishedAt?: number | null;
    updatedAt?: number;
  }): Promise<ManagerRunRecord | null>;
  updateSession?(sessionId: string, patch: {
    title?: string;
    runtimeDomainVersion?: string | null;
    activeWorkflowType?: string | null;
    activeWorkflowStateData?: string | null;
    latestSummaryId?: string | null;
    latestMessageAt?: number;
    updatedAt?: number;
  }): Promise<ManagerSessionRecord | null>;
  getActiveRun?(sessionId: string): Promise<ManagerRunRecord | null>;
  getLatestRun?(sessionId: string): Promise<ManagerRunRecord | null>;
}

export interface ManagerRuntimeDomainRegistry {
  resolve(domainId?: string | null): DomainRuntimePack;
  getById?(domainId?: string | null): DomainRuntimePack | null;
}

export interface ManagerContextAssemblyResult {
  fragments: ContextFragment[];
  usage: ContextUsageSnapshot;
  snapshot: ManagerContextSnapshot;
}

export interface ManagerGatewaySummaryService {
  getLatestSummary(sessionId: string): Promise<ManagerSummaryRecord | null>;
  refreshSessionSummary(input: {
    sessionId: string;
    messages: ManagerMessageRecord[];
  }): Promise<ManagerSummaryRecord | null>;
}

export interface ManagerGatewayMemoryService {
  listRelevantMemories(input: {
    session: RuntimeSessionSnapshot;
    limit?: number;
  }): Promise<ManagerMemoryRecord[]>;
  persistMemoryWrites(input: {
    session: RuntimeSessionSnapshot;
    runtimePack: DomainRuntimePack;
    writes: MemoryWriteRequest[];
  }): Promise<ManagerMemoryRecord[]>;
}

export interface ManagerGatewayContextAssembler {
  assemble(input: {
    session: ManagerSessionRecord;
    activeRun: ManagerRunRecord | null;
    activeWorkflow: SessionWorkflowStateSnapshot | null;
    feed: ManagerFeedBlock[];
    runtimePack: DomainRuntimePack;
    intent?: AnalysisIntent | null;
    recentMessages?: RuntimeConversationTurn[];
  }): Promise<ManagerContextAssemblyResult>;
}

export interface ManagerGatewayRunCoordinator {
  reserve(sessionId: string): {
    queued: boolean;
    bindRunId(runId: string): void;
    bindAbortController(controller: AbortController): void;
    run<T>(task: () => Promise<T>): Promise<T>;
    cancel(): boolean;
  };
  cancelRun(runId: string): 'cancelled' | 'aborting' | 'running' | 'not_found';
  cancelLatestQueuedRun(sessionId: string): string | null;
  isSessionBusy(sessionId: string): boolean;
  runExclusive<T>(sessionId: string, task: () => Promise<T>): Promise<T>;
}

export interface ManagerGateway {
  getOrCreateMainSession(input?: GetOrCreateMainSessionInput): Promise<ManagerSessionProjection>;
  loadSessionProjection(sessionId: string): Promise<ManagerSessionProjection | null>;
  submitMainSessionTurn(input: SubmitMainSessionTurnInput): Promise<ManagerGatewayTurnResult>;
  cancelSessionRun(
    sessionId: string,
    input?: {
      mode?: 'auto' | 'running' | 'queued';
    },
  ): Promise<ManagerGatewayRunCancelResult>;
}
