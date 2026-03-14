import type { DomainAutomationCapability } from './automation';

export type RuntimeIntentType = 'query' | 'analyze' | 'schedule' | 'explain' | 'clarify';
export type RuntimeTargetType = 'event' | 'subject' | 'group' | 'timeline';
export type RuntimeFeedBlockType =
  | 'assistant_text'
  | 'tool_status'
  | 'tool_result'
  | 'draft_bundle'
  | 'approval_request'
  | 'navigation_intent'
  | 'error_notice'
  | 'context_notice';
export type RuntimeMemoryScopeType = 'global' | 'domain' | 'session';

export interface RuntimeLocalizedText {
  zh?: string;
  en?: string;
}

export interface SessionWorkflowStateSnapshot {
  workflowType: string;
  stateData: Record<string, unknown>;
  updatedAt?: number;
}

export interface RuntimeConversationTurn {
  role: 'user' | 'assistant' | 'system';
  text: string;
  blockType?: string;
  createdAt?: number;
}

export interface ResolveContext {
  language: 'zh' | 'en';
  sessionId?: string;
  activeDomainId?: string;
  recentMessages?: RuntimeConversationTurn[];
  activeWorkflow?: SessionWorkflowStateSnapshot | null;
  now?: Date;
  signal?: AbortSignal;
}

export interface DomainSubject {
  domainId: string;
  subjectType: string;
  subjectId: string;
  label: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
}

export interface DomainEvent {
  domainId: string;
  eventType: string;
  eventId: string;
  title: string;
  subjectRefs: Array<{
    subjectType: string;
    subjectId: string;
    role?: string;
  }>;
  startTime?: string;
  endTime?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface DomainSignal {
  domainId: string;
  signalType: string;
  sourceId: string;
  title?: string;
  score?: number;
  payload?: Record<string, unknown>;
  createdAt?: string;
}

export interface AnalysisIntent {
  domainId: string;
  intentType: RuntimeIntentType;
  targetType?: RuntimeTargetType;
  subjectRefs?: DomainSubject[];
  eventRefs?: DomainEvent[];
  requestedWindow?: {
    start?: string;
    end?: string;
  };
  requestedFactors?: string[];
  requestedSequence?: string[];
  rawInput: string;
}

export interface ContextFragment {
  id: string;
  category:
    | 'summary'
    | 'memory'
    | 'recent_turns'
    | 'domain_state'
    | 'runtime_state'
    | 'tool_affordance';
  priority: number;
  text: string;
  tokenEstimate?: number;
  metadata?: Record<string, unknown>;
}

export interface RuntimeSessionSnapshot {
  sessionId: string;
  sessionKey: string;
  domainId: string;
  title: string;
  runtimeDomainVersion?: string | null;
  activeWorkflow?: SessionWorkflowStateSnapshot | null;
}

export interface DomainQueryCatalog {
  eventListQueryType?: string;
  matchListQueryType?: string;
}

export interface DomainRuntimeBindings {
  sourceAdapterIds: string[];
  queryCatalog?: DomainQueryCatalog;
}

export interface DomainContextInput {
  session: RuntimeSessionSnapshot;
  recentMessages: RuntimeConversationTurn[];
  intent?: AnalysisIntent | null;
  runtimeBindings: DomainRuntimeBindings;
  domainState?: {
    activeWorkflow?: SessionWorkflowStateSnapshot | null;
  };
}

export interface RuntimeFeedBlockInput {
  blockType: RuntimeFeedBlockType;
  role?: 'assistant' | 'system';
  text?: string;
  payload?: Record<string, unknown>;
}

export interface MemoryWriteRequest {
  scopeType: RuntimeMemoryScopeType;
  scopeId: string;
  memoryType: string;
  keyText: string;
  contentText: string;
  importance?: number;
  source?: string;
}

export interface RuntimeToolExecutionResult {
  blocks: RuntimeFeedBlockInput[];
  sessionPatch?: {
    title?: string;
    activeWorkflow?: SessionWorkflowStateSnapshot | null;
  };
  memoryWrites?: MemoryWriteRequest[];
  navigationIntent?: {
    route: string;
    state?: Record<string, unknown>;
  };
  diagnostics?: Record<string, unknown>;
}

export interface RuntimeManagerLegacyEffectInput {
  agentText: string;
  messageKind: 'text' | 'draft_bundle';
  draftIds?: string[];
  action?: unknown;
  draftsToSave?: Array<{ id: string }>;
  pendingTask?: Record<string, unknown> | null;
  shouldRefreshTaskState?: boolean;
  feedbackMessage?: string;
  navigation?: {
    route: string;
    state?: Record<string, unknown>;
  };
  memoryCandidates?: unknown[];
}

export interface RuntimeManagerCapability {
  domainId: string;
  skillIds: string[];
  plannerHints?: {
    helpText?: RuntimeLocalizedText;
    factorsText?: RuntimeLocalizedText;
    sequenceText?: RuntimeLocalizedText;
    defaultWorkflowType?: string;
  };
  parsePendingTask?(
    workflow: SessionWorkflowStateSnapshot | null | undefined,
  ): Record<string, unknown> | null;
  mapLegacyEffect?(
    effect: RuntimeManagerLegacyEffectInput,
  ): RuntimeToolExecutionResult;
}

export interface ToolEligibilityInput {
  input: string;
  language: 'zh' | 'en';
  intent?: AnalysisIntent | null;
  session: RuntimeSessionSnapshot;
  activeWorkflow?: SessionWorkflowStateSnapshot | null;
}

export interface ToolExecutionInput extends ToolEligibilityInput {
  contextFragments?: ContextFragment[];
  signal?: AbortSignal;
}

export interface DomainToolDefinition {
  id: string;
  description: string;
  canHandle(input: ToolEligibilityInput): boolean;
  execute(input: ToolExecutionInput): Promise<RuntimeToolExecutionResult>;
}

export interface WorkflowResumeInput {
  input: string;
  language: 'zh' | 'en';
  session: RuntimeSessionSnapshot;
  workflow: SessionWorkflowStateSnapshot;
  signal?: AbortSignal;
}

export interface WorkflowResumeResult extends RuntimeToolExecutionResult {
  workflowHandled: boolean;
}

export interface DomainWorkflowHandler {
  workflowType: string;
  canResume(state: SessionWorkflowStateSnapshot): boolean;
  resume(input: WorkflowResumeInput): Promise<WorkflowResumeResult>;
}

export interface DomainContextProvider {
  id: string;
  collect(input: DomainContextInput): Promise<ContextFragment[]>;
}

export interface SourceAdapterSupportInput {
  domainId: string;
  queryType?: string;
}

export interface DomainSyncInput {
  domainId: string;
  requestedAt: string;
  signal?: AbortSignal;
}

export interface DomainQueryInput {
  domainId: string;
  queryType: string;
  filters?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface DomainQueryResult {
  subjects?: DomainSubject[];
  events?: DomainEvent[];
  signals?: DomainSignal[];
}

export interface DomainSourceAdapter {
  id: string;
  supports(input: SourceAdapterSupportInput): boolean;
  sync?(input: DomainSyncInput): Promise<void>;
  query(input: DomainQueryInput): Promise<DomainQueryResult>;
  normalize(input: unknown): DomainSubject[] | DomainEvent[] | DomainSignal[];
}

export interface DomainMemoryPolicy {
  shouldPersist?(request: MemoryWriteRequest): boolean;
}

export interface DomainLegacyAdapters {
  analysisDomainId?: string;
  planningDomainId?: string;
}

export interface DomainRuntimeManifest {
  domainId: string;
  version: string;
  displayName: string;
  supportedIntentTypes: RuntimeIntentType[];
  supportedEventTypes: string[];
  supportedFactorIds: string[];
  defaultSequence?: string[];
}

export interface DomainResolver {
  resolveIntent(input: string, ctx: ResolveContext): Promise<AnalysisIntent | null>;
  resolveSubjects(query: string, ctx: ResolveContext): Promise<DomainSubject[]>;
  resolveEvents(intent: AnalysisIntent, ctx: ResolveContext): Promise<DomainEvent[]>;
}

export interface DomainRuntimePack {
  manifest: DomainRuntimeManifest;
  resolver: DomainResolver;
  sourceAdapters: DomainSourceAdapter[];
  automation?: DomainAutomationCapability;
  manager?: RuntimeManagerCapability;
  contextProviders: DomainContextProvider[];
  tools: DomainToolDefinition[];
  workflows?: DomainWorkflowHandler[];
  memoryPolicy?: DomainMemoryPolicy;
  queryCatalog?: DomainQueryCatalog;
  legacyAdapters?: DomainLegacyAdapters;
}
