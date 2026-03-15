# Cross-Domain Manager Orchestration Design

**Goal:** Let the manager agent coordinate multiple domains from one top-level conversation without forcing all domains into one shared workflow shape or one shared context window.

**Status:** Architecture design only. No production orchestration changes are implemented by this document.

---

## 1. Problem

The current manager architecture supports:

- one main session per domain
- one `activeWorkflow` per session
- one runtime pack bound to the session's `domainId`

That works for:

- football-only conversations
- project-ops-only conversations
- one domain active at a time

It does not work well for:

- one user turn that mentions multiple domains
- a single conversation that needs to switch between domains
- a manager that should decompose one request into several domain-specific workstreams

The generic intake refactor fixes the "football semantics leaking into all domains" problem, but it does not by itself solve cross-domain orchestration.

## 2. Current Constraints

The real bottlenecks are structural, not prompt-level:

- `ManagerSessionRecord` is still domain-bound.
- `ManagerSessionProjection` has one `runtimeDomainId`.
- `ManagerSessionProjection` has one `activeWorkflow`.
- `createManagerGateway().submitMainSessionTurn(...)` resolves one runtime pack from the session domain and runs the full pipeline against that one pack.
- `sessionStore.getOrCreateMainSession(...)` builds one main session key per domain.

This means the current system model is:

`one visible conversation thread = one active domain runtime = one active workflow`

That model must change if the manager should truly coordinate multiple domains.

## 3. Design Options

### Option A: Single session with `activeWorkflows[]`

Add an array of active workflows to the existing session and let one session carry multiple domain workflows.

Pros:

- Minimal visible model change
- Keeps one message feed

Cons:

- Context assembly becomes messy because one session would contain mixed-domain turns
- Cancellation, summarization, and memory writes become ambiguous
- Each domain would read irrelevant turns from other domains unless we add extra filtering everywhere
- UI state becomes harder because every card, strip, and resume action must infer which domain a block belongs to

Verdict:

- Not recommended as the first cross-domain architecture

### Option B: Supervisor session plus child domain sessions

Introduce one top-level supervisor session for the user-facing conversation and one child session per domain work item. The supervisor orchestrates; child sessions execute domain logic.

Pros:

- Preserves domain-local context windows
- Reuses the current domain-bound gateway model inside each child session
- Makes cancellation and resumption much cleaner
- Gives us a natural place to represent multi-domain plans and progress
- Lets the UI stay conversation-first while the backend stays domain-clean

Cons:

- Adds a second session layer
- Requires explicit synchronization from child session state back into the supervisor projection

Verdict:

- Recommended

### Option C: Manual session switching only

Keep multiple domain sessions, but let the user or UI manually switch between them instead of having a true orchestrator.

Pros:

- Very cheap to implement

Cons:

- Not a true manager
- Fails the "one supervisor can coordinate several domains" goal

Verdict:

- Useful as a fallback UX, but not sufficient as the target architecture

## 4. Recommended Architecture

Recommendation:

- Add a **supervisor session** as the only user-visible "main" conversation.
- Let the supervisor create and manage **child domain sessions**.
- Keep **one active workflow per child session**.
- Let the supervisor track a **composite workflow** that references child items.

This preserves the benefits of the current architecture:

- runtime packs are still domain-local
- domain workflows still stay domain-owned
- intake logic remains generic within each domain

But it adds a new orchestration layer above them.

## 5. Core Model

### 5.1 Supervisor Session

The supervisor session is the user's top-level conversation with the manager.

Responsibilities:

- receive raw user input
- run global routing and decomposition
- decide whether the request is:
  - single-domain
  - cross-domain
  - ambiguous
- create child work items
- decide which child is active now
- mirror child progress back into the main thread

### 5.2 Child Domain Session

Each child session is bound to one runtime domain and can reuse the current gateway model:

- one `runtimeDomainId`
- one `activeWorkflow`
- one domain-owned `taskIntake`
- one domain-specific context window

Responsibilities:

- domain-local intent resolution
- domain-local intake clarification
- domain-local draft/job generation
- domain-local memory and context usage

### 5.3 Composite Workflow

The supervisor keeps a composite workflow representing all active work items.

Suggested shape:

```ts
interface ManagerCompositeWorkflowState {
  schemaVersion: 'manager_composite_v1';
  workflowId: string;
  workflowType: 'manager_composite';
  sourceText: string;
  items: ManagerCompositeItem[];
  activeItemId: string | null;
  status: 'planning' | 'active' | 'blocked' | 'completed';
  createdAt: number;
  updatedAt: number;
}

interface ManagerCompositeItem {
  itemId: string;
  title: string;
  domainId: string;
  status: 'pending' | 'active' | 'blocked' | 'completed' | 'failed';
  childSessionId?: string;
  childWorkflowType?: string | null;
  childWorkflowStateData?: Record<string, unknown> | null;
  summary?: string;
  pendingLabel?: string;
}
```

This is the key point:

- child sessions stay normal
- only the supervisor needs multi-item orchestration state

## 6. Routing Pipeline

### Stage 1: Global domain router

Before choosing a runtime pack, run a router that can return:

- one domain candidate
- multiple domain candidates
- zero candidates

Suggested output:

```ts
interface ManagerRoutingResult {
  mode: 'single' | 'composite' | 'ambiguous';
  items: Array<{
    domainId: string;
    sourceText: string;
    confidence: number;
    reason?: string;
  }>;
}
```

### Stage 2: Work-item creation

If `mode === 'single'`:

- create or reuse one child domain session
- forward the turn to that child

If `mode === 'composite'`:

- create several work items
- choose one active item
- append a supervisor summary like:
  - "I split this into football + project ops"
  - "We can start with football first, then project ops"

### Stage 3: Active-child dispatch

The supervisor dispatches the current turn to only one child session at a time.

This is the recommended first iteration:

- **multi-domain decomposition**
- **single active child**
- **sequential advancement**

Not:

- all children running clarification loops at once

That keeps the user experience understandable and keeps the top strip/UI manageable.

## 7. Why Sequential Child Advancement First

It is tempting to let the supervisor fan out to many domains immediately. That is a mistake for the current product stage.

Sequential child advancement is better because:

- the user only needs to answer one clarification at a time
- the top strip can show one active step without becoming unreadable
- cancellation stays simple
- mobile UI stays manageable
- context assembly remains predictable

Parallel child execution can be added later for tasks that are already complete and need no clarification.

## 8. Session Model Changes

### 8.1 Session Record

Current `ManagerSessionRecord` is too narrow. Extend it with session kind:

```ts
type ManagerSessionKind = 'domain_main' | 'supervisor' | 'domain_child';

interface ManagerSessionRecord {
  ...
  sessionKind: ManagerSessionKind;
  parentSessionId?: string | null;
  ownerDomainId?: string | null;
}
```

Semantics:

- `supervisor`: top-level user-facing session
- `domain_child`: child runtime session created by the supervisor
- `domain_main`: compatibility mode for old single-domain sessions during migration

### 8.2 Projection

Do not overload `ManagerSessionProjection.activeWorkflow` to mean both child workflow and composite orchestration.

Instead add:

```ts
interface ManagerSessionProjection {
  ...
  activeWorkflow: SessionWorkflowStateSnapshot | null;
  compositeWorkflow?: ManagerCompositeWorkflowState | null;
  childWorkItems?: ManagerCompositeItem[];
}
```

Rules:

- child sessions use `activeWorkflow`
- supervisor sessions use `compositeWorkflow`

## 9. UI Model

### Top Status Strip

For supervisor sessions:

- primary label: current active child title
- secondary info:
  - domain chip
  - child pending state
  - total item counts

Example:

- `当前处理：Football / 皇马 vs 巴萨`
- `待继续 2 / 已完成 1`

For child sessions:

- keep current domain-local behavior

### Continue Cards

Continue cards should represent child work items, not raw draft heuristics.

Example:

- `Football | 需要补充分析顺序`
- `Project Ops | 需要补充关注方向`
- `Stocks | 已就绪，等待执行`

### Conversation Thread

Supervisor thread should contain:

- router summaries
- decomposition summaries
- child result summaries
- explicit handoffs between domains

Child internal chatter should stay in child sessions unless needed for the user-facing thread.

That prevents the main thread from becoming unreadable while still preserving the full child audit trail if we need to inspect it.

## 10. Cancellation and Resumption

Cancellation should happen at two levels:

- supervisor-level cancellation
- child-session-level cancellation

Rules:

- if the active item is running, cancel the child run
- if the active item is pending clarification, mark that item blocked or paused
- do not automatically cancel sibling items unless the user explicitly cancels the whole composite workflow

Resumption:

- default resume target = `activeItemId`
- if the user explicitly references another item, the supervisor may switch the active item

## 11. Memory and Summary Policy

Do not let supervisor memory and child memory collapse into one pool.

Recommended:

- child sessions write domain-specific memories
- supervisor writes orchestration memories only

Examples:

- child memory:
  - football preferences
  - project-ops focus patterns
- supervisor memory:
  - user often wants cross-domain decomposition
  - user prefers sequential processing order

Summaries:

- child sessions keep their own summaries
- supervisor stores a compressed summary of child progress and final outcomes

## 12. Migration Plan

### Phase A: Global router with auto domain switching

Goal:

- detect domain from one user turn before entering domain intake

Behavior:

- still only one child/session active
- no composite workflow yet

Value:

- fixes "wrong domain chosen" problems
- small migration step

### Phase B: Supervisor session + child sessions

Goal:

- introduce orchestration layer while keeping child domain runtime unchanged

Behavior:

- one user-facing supervisor session
- one active child item at a time

Value:

- enables true cross-domain conversation structure

### Phase C: Composite workflow UI

Goal:

- make top strip and continue cards show child work items

Behavior:

- domain chips
- per-item pending state
- explicit active item

### Phase D: Optional parallel execution

Goal:

- allow completed child tasks to execute concurrently when no clarification is needed

Behavior:

- still one active clarification target
- background execution can be multi-child

## 13. Key ADRs

### ADR-1: Do not store multiple domain workflows in one domain session

Decision:

- Use supervisor + child sessions instead of `activeWorkflows[]` inside one session.

Why:

- domain context and workflow logic stay isolated
- far less operational ambiguity

### ADR-2: Composite workflow belongs to the supervisor only

Decision:

- Only the supervisor session owns cross-domain orchestration state.

Why:

- keeps child sessions simple and reusable

### ADR-3: Start with decomposition plus single active child

Decision:

- first rollout is not multi-child clarification in parallel

Why:

- lowers UX and implementation risk

## 14. Files That Will Need to Change Later

Primary impact area:

- `src/services/manager-gateway/types.ts`
- `src/services/manager-gateway/sessionStore.ts`
- `src/services/manager-gateway/gateway.ts`
- `src/services/manager/runtimeIntentRouter.ts`
- `src/pages/command/homeLayoutModel.ts`
- `src/pages/command/feedAdapter.ts`
- `src/services/manager-intake/*`

Likely new modules:

- `src/services/manager-orchestration/router.ts`
- `src/services/manager-orchestration/compositeWorkflow.ts`
- `src/services/manager-orchestration/childSessionBridge.ts`
- `src/services/manager-orchestration/types.ts`

## 15. Recommendation

The right next target is:

- finish generic intake migration first
- then add a supervisor orchestration layer
- then support multi-domain decomposition with one active child at a time

Do **not** jump directly to fully parallel multi-domain workflows in the same session. That would multiply complexity across:

- state storage
- UI continuation logic
- cancellation
- context assembly
- summaries

The recommended milestone is:

**"One visible manager conversation can decompose a request into several domain work items, but only one child workflow is active at a time."**

That milestone is both useful and realistic.
