# MatchFlow Manager Gateway and Runtime Domain Pack Design

Date: 2026-03-11
Status: Draft for validation before implementation
Scope: MatchFlow client manager experience, session runtime, context pipeline, and domain capability architecture

## 1. Goal

Build a manager system that is:

1. session-based instead of page-state-based
2. domain-neutral at the core
3. able to mount different runtime domain capabilities through a stable contract
4. compatible with the current football experience as the first reference implementation
5. ready for future hot-pluggable domain data sources without rewriting the manager core

This design does not optimize only for football.
Football is the first runtime domain pack used to validate the contract.

## 2. Current Constraints

The current manager implementation is useful but structurally narrow:

1. session state is owned by the page/runtime helper in `src/services/manager/runtime.ts`
2. manager conversation and pending task state are stored in `localStorage`
3. football-specific terms, heuristics, and workflow logic are embedded in:
   - `src/services/manager/toolRegistry.ts`
   - `src/services/managerAgent.ts`
   - `src/agents/manager_command_center.ts`
4. the current "domain pack" concept in `src/services/domains/packTypes.ts` is metadata-only
   - it aliases a built-in domain
   - it does not provide runtime resolver/tools/context behavior
5. the current built-in domain architecture already has:
   - `AnalysisDomain`
   - `BuiltinDomainModule`
   - `DomainPlanningStrategy`

The new design must not create a second unrelated domain system.
It should become the new runtime-capability layer and provide adapters for the current legacy domain services during migration.

## 3. Naming Decision

To avoid collision with the existing Hub manifest system, this design uses two different terms:

1. `DomainPackManifest`
   - existing metadata pack from Hub
   - remains in `src/services/domains/packTypes.ts`
   - continues to describe installable alias/resource metadata
2. `DomainRuntimePack`
   - new runtime capability pack
   - defines resolver, tools, workflow handlers, context providers, source adapters, and domain semantics

This distinction is mandatory.
If both are called "domain pack" in code, the implementation will become ambiguous very quickly.

## 4. Requirements

### 4.1 Functional

1. The manager must own durable sessions.
2. The manager must support one main session and future new/fork/resume behavior.
3. The manager must route each turn through a single gateway entrypoint.
4. The manager must assemble context from:
   - transcript
   - summary
   - memory
   - live runtime facts
   - domain-provided context fragments
5. The manager must support domain-defined multi-turn workflows such as task intake.
6. The manager must let a domain mount multiple data source adapters behind one domain runtime pack.
7. The manager UI must render a stable projection of gateway-owned state, not page-owned truth.

### 4.2 Non-Functional

1. local-first storage on device
2. deterministic fallback behavior
3. testable without live AI
4. easy to inspect and debug
5. no football assumptions inside the manager core

## 5. Non-Goals

1. no remote plugin execution on client in this phase
2. no arbitrary third-party code loading in production runtime
3. no fully autonomous agent loop with unbounded tool chaining
4. no full migration of all existing analysis pages in phase 1
5. no replacement of the current Hub metadata pack mechanism in phase 1

## 6. Architecture Overview

```text
Command UI
    |
    v
Manager Gateway
    |
    +-- Session Store
    +-- Run Coordinator
    +-- Context Assembler
    +-- Planner / Policy
    +-- Tool Runtime
    +-- Memory / Summary Service
    +-- Session Projector
    +-- Runtime Domain Registry
            |
            +-- footballRuntimePack
            +-- futureRuntimePack...
```

The key architectural rule is:

`Core owns runtime and lifecycle. Domains own semantics and data access.`

## 7. Core Components

## 7.1 Manager Gateway

Single entrypoint for all manager interactions.

Responsibilities:

1. resolve or create session
2. enqueue and execute one run per session
3. load active workflow state if present
4. resolve runtime domain pack
5. assemble working context
6. choose deterministic, workflow, or LLM-assisted path
7. execute tools
8. write transcript, summary, memory, and session state
9. expose event stream and session projection to UI

Proposed file:

`src/services/manager-gateway/gateway.ts`

## 7.2 Session Store

Persists manager-owned entities in SQLite.

Responsibilities:

1. CRUD for sessions
2. append-only transcript writes
3. run lifecycle persistence
4. session-scoped active workflow state
5. summary and memory reads/writes

Proposed files:

- `src/services/manager-gateway/sessionStore.ts`
- `src/services/manager-gateway/repositories/*.ts`

## 7.3 Run Coordinator

Serializes runs by session id.

Responsibilities:

1. only one active run per session
2. queue or reject additional input by policy
3. support later interrupt/continue behavior

Phase 1 policy:

1. same-session submissions are queued
2. explicit stop support is deferred

## 7.4 Context Assembler

Builds the actual working context sent to planner or model.

Responsibilities:

1. gather recent transcript
2. load last summary
3. retrieve memory fragments
4. collect domain context fragments
5. include live runtime facts
6. prune low-value blocks before model use

## 7.5 Planner / Policy

Routes each turn through one of three paths:

1. deterministic
2. workflow-resume
3. LLM-assisted planning

The planner does not know football rules.
It only sees capability metadata and current session state.

## 7.6 Tool Runtime

Executes standard tool contracts and produces standard result envelopes.

It must not:

1. write directly to React state
2. assume specific domain entities
3. bypass session persistence

## 7.7 Session Projector

Produces UI-facing session projections from transcript and runtime state.

Responsibilities:

1. merge message blocks into renderable feed items
2. attach draft cards, navigation intents, approval requests, and status notices
3. keep UI schema stable even when internal tool contracts evolve

## 8. Runtime Domain Pack

## 8.1 Contract

```ts
export interface DomainRuntimePack {
  manifest: DomainRuntimeManifest;
  resolver: DomainResolver;
  sourceAdapters: DomainSourceAdapter[];
  contextProviders: DomainContextProvider[];
  tools: DomainToolDefinition[];
  workflows?: DomainWorkflowHandler[];
  memoryPolicy?: DomainMemoryPolicy;
  legacyAdapters?: DomainLegacyAdapters;
}
```

```ts
export interface DomainRuntimeManifest {
  domainId: string;
  version: string;
  displayName: string;
  supportedIntentTypes: Array<"query" | "analyze" | "schedule" | "explain" | "clarify">;
  supportedEventTypes: string[];
  supportedFactorIds: string[];
  defaultSequence?: string[];
}
```

```ts
export interface DomainResolver {
  resolveIntent(input: string, ctx: ResolveContext): Promise<AnalysisIntent | null>;
  resolveSubjects(query: string, ctx: ResolveContext): Promise<DomainSubject[]>;
  resolveEvents(intent: AnalysisIntent, ctx: ResolveContext): Promise<DomainEvent[]>;
}
```

```ts
export interface DomainContextProvider {
  id: string;
  collect(input: DomainContextInput): Promise<ContextFragment[]>;
}
```

```ts
export interface DomainToolDefinition {
  id: string;
  description: string;
  canHandle(input: ToolEligibilityInput): boolean;
  execute(input: ToolExecutionInput): Promise<ToolExecutionResult>;
}
```

```ts
export interface DomainWorkflowHandler {
  workflowType: string;
  canResume(state: SessionWorkflowState): boolean;
  resume(input: WorkflowResumeInput): Promise<WorkflowResumeResult>;
}
```

## 8.2 Canonical Models

Core consumes only domain-neutral canonical models:

```ts
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
  intentType: "query" | "analyze" | "schedule" | "explain" | "clarify";
  targetType?: "event" | "subject" | "group" | "timeline";
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
```

Core code must never operate on raw source payloads from external adapters.

## 8.3 Source Adapter Layer

Each runtime domain pack may register multiple source adapters.

```ts
export interface DomainSourceAdapter {
  id: string;
  supports(input: SourceAdapterSupportInput): boolean;
  sync?(input: DomainSyncInput): Promise<void>;
  query(input: DomainQueryInput): Promise<DomainQueryResult>;
  normalize(input: unknown): DomainSubject[] | DomainEvent[] | DomainSignal[];
}
```

For football in phase 1:

1. local synced matches adapter wraps `src/services/syncedMatches.ts`
2. future odds/news/custom-note sources can be added without changing the manager core

## 9. Storage Design

## 9.1 SQLite Tables

Add manager tables to `src/services/db.ts`.

### `manager_sessions`

Fields:

1. `id TEXT PRIMARY KEY`
2. `sessionKey TEXT NOT NULL UNIQUE`
3. `title TEXT NOT NULL`
4. `status TEXT NOT NULL`
5. `domainId TEXT NOT NULL`
6. `runtimeDomainVersion TEXT`
7. `activeWorkflowType TEXT`
8. `activeWorkflowStateData TEXT`
9. `latestSummaryId TEXT`
10. `latestMessageAt INTEGER NOT NULL`
11. `createdAt INTEGER NOT NULL`
12. `updatedAt INTEGER NOT NULL`

Indexes:

1. `idx_manager_sessions_status_updated(status, updatedAt DESC)`
2. `idx_manager_sessions_domain_updated(domainId, updatedAt DESC)`

### `manager_messages`

Fields:

1. `id TEXT PRIMARY KEY`
2. `sessionId TEXT NOT NULL`
3. `runId TEXT`
4. `ordinal INTEGER NOT NULL`
5. `role TEXT NOT NULL`
6. `blockType TEXT NOT NULL`
7. `text TEXT`
8. `payloadData TEXT`
9. `createdAt INTEGER NOT NULL`

Indexes:

1. `UNIQUE(sessionId, ordinal)`
2. `idx_manager_messages_session_created(sessionId, createdAt DESC)`

### `manager_runs`

Fields:

1. `id TEXT PRIMARY KEY`
2. `sessionId TEXT NOT NULL`
3. `inputMessageId TEXT`
4. `status TEXT NOT NULL`
5. `triggerType TEXT NOT NULL`
6. `plannerMode TEXT`
7. `intentType TEXT`
8. `toolPath TEXT`
9. `errorCode TEXT`
10. `errorMessage TEXT`
11. `stateData TEXT`
12. `startedAt INTEGER`
13. `finishedAt INTEGER`
14. `createdAt INTEGER NOT NULL`
15. `updatedAt INTEGER NOT NULL`

Indexes:

1. `idx_manager_runs_session_created(sessionId, createdAt DESC)`
2. `idx_manager_runs_status_updated(status, updatedAt DESC)`

### `manager_summaries`

Fields:

1. `id TEXT PRIMARY KEY`
2. `sessionId TEXT NOT NULL`
3. `kind TEXT NOT NULL`
4. `cutoffOrdinal INTEGER NOT NULL`
5. `summaryText TEXT NOT NULL`
6. `sourceMessageCount INTEGER NOT NULL`
7. `createdAt INTEGER NOT NULL`

Indexes:

1. `idx_manager_summaries_session_created(sessionId, createdAt DESC)`

### `manager_memories`

Fields:

1. `id TEXT PRIMARY KEY`
2. `scopeType TEXT NOT NULL`
3. `scopeId TEXT NOT NULL`
4. `memoryType TEXT NOT NULL`
5. `keyText TEXT NOT NULL`
6. `contentText TEXT NOT NULL`
7. `importance REAL`
8. `source TEXT`
9. `createdAt INTEGER NOT NULL`
10. `updatedAt INTEGER NOT NULL`

Indexes:

1. `idx_manager_memories_scope_updated(scopeType, scopeId, updatedAt DESC)`
2. `idx_manager_memories_key(scopeType, scopeId, keyText)`

## 9.2 Why Session Workflow State Lives on Session

The current `pendingTask` in `src/services/manager/runtime.ts` is not a durable manager concept.
It is a special case of "active workflow waiting for user input".

Phase 1 stores this as:

1. `manager_sessions.activeWorkflowType`
2. `manager_sessions.activeWorkflowStateData`

This is enough to replace `pendingTask` without over-designing a workflow engine.
If later multiple concurrent workflows per session are required, this can move into a dedicated table.

## 10. Session and Message Model

## 10.1 Message Blocks

UI should stop assuming only `text` and `draft_bundle`.
The projector should support these block types:

1. `user_text`
2. `assistant_text`
3. `tool_status`
4. `tool_result`
5. `draft_bundle`
6. `approval_request`
7. `navigation_intent`
8. `error_notice`
9. `context_notice`

Phase 1 UI may render some of them similarly, but the transcript model must distinguish them now.

## 10.2 Session Projection

```ts
export interface ManagerSessionProjection {
  session: ManagerSessionRecord;
  feed: ManagerFeedBlock[];
  activeRun: ManagerRunRecord | null;
  activeWorkflow: SessionWorkflowState | null;
  contextUsage?: ContextUsageSnapshot;
}
```

The UI consumes `ManagerSessionProjection`.
It no longer owns canonical messages.

## 11. Run Lifecycle

Phase 1 run lifecycle:

1. UI submits `sessionId + input`
2. gateway creates a user message
3. run coordinator queues a run for the session
4. gateway loads session state
5. if `activeWorkflowStateData` exists:
   - try workflow-resume path first
6. else resolve runtime domain pack
7. domain resolver creates `AnalysisIntent`
8. planner chooses:
   - deterministic tool
   - workflow-start
   - LLM-assisted planning
9. tool runtime executes
10. tool result yields:
   - feed blocks
   - session patch
   - memory writes
   - optional navigation intent
11. gateway appends assistant-side transcript blocks
12. gateway updates summary/memory/session state
13. projector emits latest projection

This replaces the current pattern in `submitManagerTurn(...)` where one helper function owns both routing and persistence.

## 12. Context Pipeline

## 12.1 Working Context Order

The context assembler should build model input in this order:

1. `System Policy`
2. `Platform Session Summary`
3. `Recent Transcript`
4. `Retrieved Memory`
5. `Domain Context Fragments`
6. `Live Runtime Facts`
7. `Available Tool Affordances`

## 12.2 Context Fragment Contract

```ts
export interface ContextFragment {
  id: string;
  category:
    | "summary"
    | "memory"
    | "recent_turns"
    | "domain_state"
    | "runtime_state"
    | "tool_affordance";
  priority: number;
  text: string;
  tokenEstimate?: number;
  metadata?: Record<string, unknown>;
}
```

## 12.3 Pruning and Compaction

Phase 1 rules:

1. retain full transcript in SQLite
2. use only a recent window plus latest summary for model input
3. prune low-value tool-status fragments before recent assistant/user turns
4. do not delete transcript rows during compaction

Compaction output is written into `manager_summaries`.

## 13. Planner and Tool Contract

## 13.1 Planner Modes

```ts
type PlannerMode = "deterministic" | "workflow" | "llm_assisted";
```

Selection rules:

1. if active workflow exists and domain workflow handler can resume, use `workflow`
2. if a deterministic domain tool can confidently handle the intent, use `deterministic`
3. otherwise use `llm_assisted`

LLM assistance is scoped:

1. one tool call per turn in phase 1
2. no recursive tool loop
3. tool selection remains constrained by runtime domain pack registration

## 13.2 Tool Result Contract

```ts
export interface ToolExecutionResult {
  blocks: ManagerFeedBlockInput[];
  sessionPatch?: {
    title?: string;
    activeWorkflow?: SessionWorkflowState | null;
  };
  memoryWrites?: MemoryWriteRequest[];
  navigationIntent?: {
    route: string;
    state?: Record<string, unknown>;
  };
  diagnostics?: Record<string, unknown>;
}
```

This removes the current coupling where tools return an ad hoc `ManagerConversationEffect` that is directly translated into page-visible messages.

## 14. Compatibility with Existing Domain Systems

## 14.1 Existing `AnalysisDomain`

Keep `AnalysisDomain` in phase 1 for existing analysis pages.

Add an adapter:

```ts
function createLegacyAnalysisDomain(pack: DomainRuntimePack): AnalysisDomain
```

This lets current analysis entrypoints continue using `getActiveAnalysisDomain()` while the new runtime pack becomes the actual semantic source.

## 14.2 Existing `DomainPlanningStrategy`

Keep current planning behavior for non-manager analysis flows.

Add:

```ts
function createLegacyPlanningStrategy(pack: DomainRuntimePack): DomainPlanningStrategy
```

This avoids a big-bang migration.

## 14.3 Existing Hub Metadata Packs

Do not delete or rename `DomainPackManifest`.
Instead:

1. Hub metadata packs continue to install alias/resource metadata.
2. Runtime domain registry uses built-in `DomainRuntimePack` code definitions in phase 1.
3. In a later phase, Hub metadata can reference a runtime domain id or capability flags, but it still does not execute arbitrary code on client.

## 15. Football Reference Implementation

Football is the first runtime domain pack and should live at:

`src/domains/runtime/football/`

Proposed files:

1. `manifest.ts`
2. `resolver.ts`
3. `context.ts`
4. `tools.ts`
5. `workflows.ts`
6. `sourceAdapters/localSyncedMatches.ts`
7. `normalizers/*.ts`
8. `legacyAdapters.ts`

Mapping of current logic:

1. `src/services/manager/toolRegistry.ts`
   - split into football tools and shared manager tool helpers
2. `src/services/managerAgent.ts`
   - split into football resolver and football analysis profile helpers
3. `src/agents/manager_command_center.ts`
   - remove football default assumptions
4. `src/services/syncedMatches.ts`
   - wrap through football source adapter

Football-specific concepts that must stay in the pack, not core:

1. league aliases
2. team name/entity resolution
3. factor ids like `fundamental`, `market`, `custom`
4. default sequence rules
5. football-specific clarification copy
6. football-specific live snapshot formatting

## 16. Proposed Directory Layout

```text
src/
  services/
    manager-gateway/
      gateway.ts
      types.ts
      sessionStore.ts
      runCoordinator.ts
      contextAssembler.ts
      planner.ts
      toolRuntime.ts
      projector.ts
      memoryService.ts
      summaryService.ts
      repositories/
        sessionsRepo.ts
        messagesRepo.ts
        runsRepo.ts
        summariesRepo.ts
        memoriesRepo.ts
  domains/
    runtime/
      types.ts
      registry.ts
      legacy/
        analysisDomainAdapter.ts
        planningStrategyAdapter.ts
      football/
        index.ts
        manifest.ts
        resolver.ts
        context.ts
        tools.ts
        workflows.ts
        legacyAdapters.ts
        sourceAdapters/
          localSyncedMatches.ts
        normalizers/
          matchNormalizer.ts
  pages/
    command/
      useCommandCenterSession.ts
      CommandCenterConversation.tsx
      CommandCenterComposer.tsx
      CommandCenterDebugPanel.tsx
```

## 17. Migration Plan

## Phase 1: Foundations

1. add manager SQLite tables in `src/services/db.ts`
2. create `DomainRuntimePack` types and registry
3. create `ManagerGateway` skeleton with in-memory event emitter
4. no UI switch yet

Exit criteria:

1. gateway can create/load a default session
2. runtime domain registry can register football pack

## Phase 2: Football Runtime Pack

1. move football resolver/context/tool/workflow logic out of current manager files
2. create football runtime pack
3. add legacy adapters back into current domain services if required

Exit criteria:

1. football runtime pack can answer current manager test cases
2. core files contain no football terms

## Phase 3: Session Migration

1. implement session store repositories
2. migrate manager conversation from `localStorage` to SQLite
3. one-time import of:
   - `matchflow_command_center_messages_v1`
   - `matchflow_command_center_pending_task_v1`
4. convert `pendingTask` into `activeWorkflowStateData`

Exit criteria:

1. current conversations survive app restart through SQLite
2. no new manager writes go to `localStorage`

## Phase 4: UI Rewire

1. replace `useCommandCenterState` direct runtime calls with gateway calls
2. consume `ManagerSessionProjection`
3. render standard feed block types

Exit criteria:

1. page no longer owns canonical conversation state
2. draft bundle and navigation behavior still work

## Phase 5: Context and Summary

1. add summary generation hooks
2. add memory service
3. expose context/debug snapshot in UI

Exit criteria:

1. working context no longer depends only on last few raw messages
2. operator can inspect why the manager answered a certain way

## 18. Compatibility Strategy

During migration:

1. current manager runtime remains available behind a compatibility wrapper
2. gateway can initially delegate some actions to current automation draft services
3. automation stores can remain as-is in early slices
4. manager session storage changes first; automation rule/job/run storage can migrate separately later

This reduces blast radius and keeps current automation flow usable.

## 19. Test Strategy

### 19.1 Unit

1. gateway session creation and run queueing
2. context assembler ordering and pruning
3. football resolver intent classification
4. football workflow resume for factor/sequence intake
5. tool runtime result projection

### 19.2 Storage

1. SQLite migration adds manager tables safely
2. import from old `localStorage` keys works
3. session/message ordering remains stable

### 19.3 Integration

1. current "today matches" flow
2. current "analyze X tonight" flow
3. workflow clarification across multiple turns
4. draft activation path
5. settings-open fallback path when AI is unavailable

### 19.4 Contract

1. core package tests asserting no football-specific ids appear in manager-gateway files
2. runtime domain pack tests asserting manifest/resolver/tool registration completeness

## 20. Risks and Mitigations

### Risk 1: Existing domain abstractions drift from runtime pack

Mitigation:

1. add explicit legacy adapters
2. keep one semantic source of truth in `DomainRuntimePack`

### Risk 2: Gateway becomes a second orchestration system next to automation runtime

Mitigation:

1. manager gateway owns conversation/session lifecycle only
2. automation runtime remains the executor for saved jobs/rules
3. use tool contracts to bridge instead of duplicating execution logic

### Risk 3: Over-generalization delays delivery

Mitigation:

1. define domain-neutral interfaces now
2. implement only the minimal interface set required by football in phase 1

### Risk 4: UI migration breaks current task cards

Mitigation:

1. keep `draft_bundle` as first-class block type
2. preserve `AutomationDraftCard` during initial projector migration

## 21. ADRs to Record

1. `ADR-001: Manager Gateway is the source of truth for manager sessions`
2. `ADR-002: Session, summary, context, and memory are separate platform concerns`
3. `ADR-003: Core runtime is domain-neutral; domains mount through DomainRuntimePack`
4. `ADR-004: Existing Hub DomainPackManifest remains metadata-only in phase 1`
5. `ADR-005: Football is the first reference implementation, not the core template`

## 22. Immediate Next Slice

Recommended first implementation slice:

1. add manager tables to `src/services/db.ts`
2. add `src/domains/runtime/types.ts`
3. add `src/domains/runtime/registry.ts`
4. add `src/services/manager-gateway/types.ts`
5. add `src/services/manager-gateway/gateway.ts` skeleton
6. register a stub `footballRuntimePack`

Do not migrate the UI in the first slice.
The first slice should prove the contracts and persistence shape before user-facing rewiring.
