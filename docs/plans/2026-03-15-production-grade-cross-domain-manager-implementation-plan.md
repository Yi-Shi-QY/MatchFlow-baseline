# Production-Grade Cross-Domain Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the manager from a single-domain conversation runtime into a production-grade supervisor that can orchestrate multiple domain-specific child workflows while preserving recoverability, observability, and backward compatibility.

**Architecture:** Keep domain execution isolated inside domain child sessions, and introduce one supervisor session that owns routing, decomposition, composite workflow state, and user-facing projection. Build on top of the new generic intake architecture so each child workflow remains domain-owned, but the top-level conversation becomes cross-domain and production-safe.

**Tech Stack:** TypeScript, manager gateway/session store, runtime domain packs, SQLite/local DB schema, Vitest, projection-first command center UI

---

## Scope

This plan is for a production-grade implementation, not a prototype. That means:

- persisted supervisor and child session state
- resumable composite workflows after app restart
- deterministic routing and orchestration boundaries
- backward-compatible migration from existing single-domain sessions
- explicit cancellation and recovery behavior
- auditability through feed projection and stored run/session state

This plan intentionally avoids the risky shortcut of stuffing multiple active domain workflows into the current single-domain session model.

## Production Criteria

The work is not done until all of these are true:

- one user-visible manager thread can own multiple domain work items
- each child work item runs in its own domain session with its own context, workflow, and memory boundary
- the supervisor session can restore active items and child pointers from storage after reload
- UI top strip, continue cards, and conversation projection all read from one authoritative composite workflow model
- cancellation works at both supervisor and child-run granularity
- old single-domain sessions still load correctly during migration
- at least one cross-domain regression suite passes for decomposition, resume, and cancel

## Architecture Decisions

### ADR-1: Supervisor session becomes the only top-level user-facing thread

Reason:
- The current `ManagerSessionProjection` is domain-bound and cannot safely carry several domains worth of runtime context.

Effect:
- A new session kind is required.
- Existing domain main sessions become a compatibility mode, not the future default.

### ADR-2: Domain execution stays in child sessions

Reason:
- Domain runtime packs, domain intake, and domain memory already assume one domain boundary.

Effect:
- Multi-domain support is achieved by orchestration above child sessions, not by weakening domain isolation.

### ADR-3: Composite workflow is the orchestration source of truth

Reason:
- Current state mismatches came from UI and runtime reading different signals.

Effect:
- Supervisor UI and resume logic must read a persisted `compositeWorkflow`, not infer from feed/drafts.

### ADR-4: First production release supports cross-domain decomposition plus one active child clarification target

Reason:
- This keeps UX understandable and operational logic safe, while the data model still supports future parallel execution.

Effect:
- Architecture is production-grade.
- Interaction policy remains intentionally conservative.

## Data Model

### Session Record Evolution

Modify `ManagerSessionRecord` so sessions can represent both top-level orchestration and domain execution.

Add:

```ts
type ManagerSessionKind = 'domain_main' | 'supervisor' | 'domain_child';

interface ManagerSessionRecord {
  ...
  sessionKind: ManagerSessionKind;
  parentSessionId?: string | null;
  ownerDomainId?: string | null;
}
```

Rules:

- `supervisor`: user-facing manager session
- `domain_child`: domain execution session attached to a supervisor
- `domain_main`: legacy compatibility path

### Composite Workflow

Persist a supervisor-owned workflow:

```ts
interface ManagerCompositeWorkflowState {
  schemaVersion: 'manager_composite_v1';
  workflowId: string;
  workflowType: 'manager_composite';
  sourceText: string;
  status: 'planning' | 'active' | 'blocked' | 'completed';
  activeItemId: string | null;
  items: ManagerCompositeItem[];
  createdAt: number;
  updatedAt: number;
}

interface ManagerCompositeItem {
  itemId: string;
  title: string;
  domainId: string;
  status: 'pending' | 'active' | 'blocked' | 'completed' | 'failed';
  childSessionId?: string | null;
  childWorkflowType?: string | null;
  childWorkflowStateData?: Record<string, unknown> | null;
  pendingLabel?: string;
  summary?: string;
}
```

### Routing Result

Create a cross-domain router result:

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

## Migration Strategy

### Compatibility policy

Do not break existing `manager:main:<domain>` sessions immediately.

Migration stages:

1. add new session kinds and fields
2. allow supervisor sessions to coexist with current domain sessions
3. read legacy sessions into compatibility projections
4. only after the supervisor path is stable, migrate new user entry to supervisor by default

### Database / storage migration

If DB-backed:

- extend `manager_sessions`
- do not drop old columns
- default old rows to `sessionKind = 'domain_main'`

If memory/localStorage-backed snapshot:

- normalize missing `sessionKind` to `domain_main`
- normalize missing `parentSessionId` / `ownerDomainId` to `null`

## Task Breakdown

### Task 1: Stabilize generic intake as the child-session execution base

**Files:**
- Modify: `src/services/manager/toolRegistry.ts`
- Modify: `src/services/manager-workspace/clarificationSummary.ts`
- Modify: `src/services/manager/types.ts`
- Modify: `src/domains/runtime/football/tools.ts`
- Modify: `src/domains/runtime/projectOps/tools.ts`
- Test: `src/services/__tests__/managerRuntime.test.ts`
- Test: `src/services/__tests__/managerGatewaySubmit.test.ts`

**Step 1: Write failing tests for the new generic intake execution path**

Add cases that assert:
- football prepare/resume no longer depends on shared football-only clarification builders
- project ops prepare/resume emits project-native prompts through the generic engine

**Step 2: Run focused tests and verify the current implementation still fails at the old bridge**

Run:

```bash
npx vitest run src/services/__tests__/managerRuntime.test.ts src/services/__tests__/managerGatewaySubmit.test.ts
```

Expected:
- failures or missing assertions around generic-intake-backed execution

**Step 3: Rewire manager prepare/resume to generic intake runtime**

Implement:
- generic prepare path
- generic resume path
- compatibility projection back into the current runtime tool result shape

**Step 4: Run focused tests and make sure they pass**

Run:

```bash
npx vitest run src/services/__tests__/managerRuntime.test.ts src/services/__tests__/managerGatewaySubmit.test.ts src/services/__tests__/managerIntakeRuntime.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/services/manager/toolRegistry.ts src/services/manager-workspace/clarificationSummary.ts src/services/manager/types.ts src/domains/runtime/football/tools.ts src/domains/runtime/projectOps/tools.ts src/services/__tests__/managerRuntime.test.ts src/services/__tests__/managerGatewaySubmit.test.ts
git commit -m "refactor: route manager intake through generic runtime"
```

### Task 2: Introduce production session kinds and storage compatibility

**Files:**
- Modify: `src/services/db.ts`
- Modify: `src/services/manager-gateway/types.ts`
- Modify: `src/services/manager-gateway/sessionStore.ts`
- Test: `src/services/__tests__/managerSessionStore.test.ts`

**Step 1: Write failing storage tests**

Add cases that assert:
- old sessions load as `domain_main`
- new sessions can persist `supervisor` and `domain_child`
- parent-child linkage survives reload

**Step 2: Run the store tests to verify failure**

Run:

```bash
npx vitest run src/services/__tests__/managerSessionStore.test.ts
```

Expected:
- FAIL because the new fields do not exist yet

**Step 3: Implement schema normalization and persistence**

Add:
- `sessionKind`
- `parentSessionId`
- `ownerDomainId`
- normalization defaults for old rows

**Step 4: Re-run the tests**

Run:

```bash
npx vitest run src/services/__tests__/managerSessionStore.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/services/db.ts src/services/manager-gateway/types.ts src/services/manager-gateway/sessionStore.ts src/services/__tests__/managerSessionStore.test.ts
git commit -m "feat: add supervisor and child session storage model"
```

### Task 3: Build supervisor orchestration types and composite workflow persistence

**Files:**
- Create: `src/services/manager-orchestration/types.ts`
- Create: `src/services/manager-orchestration/compositeWorkflow.ts`
- Modify: `src/services/manager-gateway/types.ts`
- Test: `src/services/__tests__/managerCompositeWorkflow.test.ts`

**Step 1: Write failing tests for composite workflow state transitions**

Cover:
- create workflow from routing result
- active item selection
- item status transitions
- supervisor restore from persisted snapshot

**Step 2: Run the tests and confirm failure**

Run:

```bash
npx vitest run src/services/__tests__/managerCompositeWorkflow.test.ts
```

Expected:
- FAIL because orchestration module does not exist

**Step 3: Implement orchestration state module**

Create:
- `createCompositeWorkflow(...)`
- `activateCompositeItem(...)`
- `syncChildStateIntoCompositeItem(...)`
- `completeCompositeItem(...)`
- `serialize/parse` helpers

**Step 4: Run tests again**

Run:

```bash
npx vitest run src/services/__tests__/managerCompositeWorkflow.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/services/manager-orchestration/types.ts src/services/manager-orchestration/compositeWorkflow.ts src/services/manager-gateway/types.ts src/services/__tests__/managerCompositeWorkflow.test.ts
git commit -m "feat: add composite workflow orchestration state"
```

### Task 4: Add global cross-domain router and work-item decomposition

**Files:**
- Create: `src/services/manager-orchestration/router.ts`
- Modify: `src/services/manager/runtimeIntentRouter.ts`
- Test: `src/services/__tests__/managerRouting.test.ts`

**Step 1: Write failing router tests**

Cases:
- football-only input returns single-domain result
- project-ops-only input returns single-domain result
- mixed-domain input returns composite result
- ambiguous input returns ambiguous result

**Step 2: Run router tests and verify failure**

Run:

```bash
npx vitest run src/services/__tests__/managerRouting.test.ts
```

Expected:
- FAIL

**Step 3: Implement global routing**

Requirements:
- route before binding to one runtime pack
- reuse domain resolver signals, but return orchestration-level routing result
- include routing reason and confidence for diagnostics

**Step 4: Re-run tests**

Run:

```bash
npx vitest run src/services/__tests__/managerRouting.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/services/manager-orchestration/router.ts src/services/manager/runtimeIntentRouter.ts src/services/__tests__/managerRouting.test.ts
git commit -m "feat: add global cross-domain manager router"
```

### Task 5: Add child-session bridge and supervisor dispatch flow

**Files:**
- Create: `src/services/manager-orchestration/childSessionBridge.ts`
- Modify: `src/services/manager-gateway/gateway.ts`
- Modify: `src/services/manager-gateway/types.ts`
- Test: `src/services/__tests__/managerSupervisorGateway.test.ts`

**Step 1: Write failing gateway tests**

Cover:
- supervisor session creation
- child session creation from routed item
- single active child dispatch
- syncing child workflow state back to supervisor composite workflow

**Step 2: Run gateway tests to verify failure**

Run:

```bash
npx vitest run src/services/__tests__/managerSupervisorGateway.test.ts
```

Expected:
- FAIL

**Step 3: Implement the bridge**

Requirements:
- create/reuse child sessions by domain
- dispatch active work item to child session runtime
- persist child session id onto composite item
- mirror child workflow state and summaries back into supervisor projection

**Step 4: Re-run tests**

Run:

```bash
npx vitest run src/services/__tests__/managerSupervisorGateway.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/services/manager-orchestration/childSessionBridge.ts src/services/manager-gateway/gateway.ts src/services/manager-gateway/types.ts src/services/__tests__/managerSupervisorGateway.test.ts
git commit -m "feat: add supervisor-to-child session dispatch"
```

### Task 6: Rebuild supervisor projection for feed, strip, and continue cards

**Files:**
- Modify: `src/pages/command/feedAdapter.ts`
- Modify: `src/pages/command/homeLayoutModel.ts`
- Modify: `src/services/manager-gateway/legacyCompat.ts`
- Test: `src/pages/command/__tests__/feedAdapter.test.ts`
- Test: `src/pages/command/__tests__/homeLayoutModel.test.ts`

**Step 1: Write failing projection/UI tests**

Cases:
- supervisor projection with multiple items renders child summaries
- top strip shows current active item instead of legacy last-flow fallback
- continue cards show domain chips and child pending labels

**Step 2: Run tests to verify failure**

Run:

```bash
npx vitest run src/pages/command/__tests__/feedAdapter.test.ts src/pages/command/__tests__/homeLayoutModel.test.ts
```

Expected:
- FAIL

**Step 3: Implement supervisor projection**

Requirements:
- one projection source of truth from composite workflow
- domain-aware continue cards
- clear mapping from child item status to UI labels

**Step 4: Re-run tests**

Run:

```bash
npx vitest run src/pages/command/__tests__/feedAdapter.test.ts src/pages/command/__tests__/homeLayoutModel.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/pages/command/feedAdapter.ts src/pages/command/homeLayoutModel.ts src/services/manager-gateway/legacyCompat.ts src/pages/command/__tests__/feedAdapter.test.ts src/pages/command/__tests__/homeLayoutModel.test.ts
git commit -m "feat: project supervisor composite workflow into command center ui"
```

### Task 7: Add production cancellation, recovery, and restart semantics

**Files:**
- Modify: `src/services/manager-gateway/gateway.ts`
- Modify: `src/services/manager-gateway/runCoordinator.ts`
- Modify: `src/services/manager-orchestration/compositeWorkflow.ts`
- Test: `src/services/__tests__/managerSupervisorCancel.test.ts`

**Step 1: Write failing cancellation/recovery tests**

Cases:
- cancel active child run without deleting sibling items
- cancel composite workflow
- reload after interruption resumes active child pointer correctly

**Step 2: Run tests and verify failure**

Run:

```bash
npx vitest run src/services/__tests__/managerSupervisorCancel.test.ts
```

Expected:
- FAIL

**Step 3: Implement cancellation and recovery rules**

Requirements:
- child run cancel does not collapse supervisor state
- supervisor cancel marks pending items deterministically
- restart restores composite active item and child workflow metadata

**Step 4: Re-run tests**

Run:

```bash
npx vitest run src/services/__tests__/managerSupervisorCancel.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/services/manager-gateway/gateway.ts src/services/manager-gateway/runCoordinator.ts src/services/manager-orchestration/compositeWorkflow.ts src/services/__tests__/managerSupervisorCancel.test.ts
git commit -m "feat: add supervisor cancellation and recovery flow"
```

### Task 8: Add observability, diagnostics, and migration reporting

**Files:**
- Modify: `src/services/manager-gateway/gateway.ts`
- Modify: `src/services/manager-gateway/types.ts`
- Create: `src/services/manager-orchestration/diagnostics.ts`
- Test: `src/services/__tests__/managerSupervisorDiagnostics.test.ts`

**Step 1: Write failing diagnostics tests**

Cover:
- routing decision recorded
- active child selection recorded
- child sync results recorded
- migration path detectable in diagnostics

**Step 2: Run tests and verify failure**

Run:

```bash
npx vitest run src/services/__tests__/managerSupervisorDiagnostics.test.ts
```

Expected:
- FAIL

**Step 3: Implement diagnostics**

Add structured diagnostics:
- router mode
- work-item count
- active child domain
- sync outcome
- legacy-session compatibility path

**Step 4: Re-run tests**

Run:

```bash
npx vitest run src/services/__tests__/managerSupervisorDiagnostics.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/services/manager-gateway/gateway.ts src/services/manager-gateway/types.ts src/services/manager-orchestration/diagnostics.ts src/services/__tests__/managerSupervisorDiagnostics.test.ts
git commit -m "feat: add supervisor orchestration diagnostics"
```

### Task 9: Run production-grade regression batch

**Files:**
- Test only

**Step 1: Run the targeted orchestration and UI suites**

Run:

```bash
npx vitest run src/services/__tests__/managerIntakeRuntime.test.ts src/services/__tests__/managerRuntime.test.ts src/services/__tests__/managerGatewaySubmit.test.ts src/services/__tests__/managerSessionStore.test.ts src/services/__tests__/managerCompositeWorkflow.test.ts src/services/__tests__/managerRouting.test.ts src/services/__tests__/managerSupervisorGateway.test.ts src/services/__tests__/managerSupervisorCancel.test.ts src/services/__tests__/managerSupervisorDiagnostics.test.ts src/pages/command/__tests__/feedAdapter.test.ts src/pages/command/__tests__/homeLayoutModel.test.ts src/domains/runtime/projectOps/__tests__/index.test.ts src/services/__tests__/managerLegacyCompat.test.ts
```

Expected:
- PASS

**Step 2: Run full build**

Run:

```bash
npm run build
```

Expected:
- PASS

**Step 3: Commit**

```bash
git add .
git commit -m "feat: ship production-grade cross-domain manager orchestration"
```

## Rollout Plan

### Release 1

- generic intake is default for football and project ops
- supervisor session model exists
- routing can create one or more child items
- one active child clarification target at a time

### Release 2

- background execution for completed child items can run concurrently
- richer supervisor feed summaries
- improved domain routing heuristics

### Release 3

- optional user-facing child-thread drill-in
- supervisor memory refinement
- prioritization policies for parallel-ready work items

## Risk Register

### Risk: legacy single-domain sessions become unreadable after migration

Mitigation:
- explicit `sessionKind = 'domain_main'`
- compatibility loader path
- migration tests in `managerSessionStore`

### Risk: mixed-domain input creates duplicate child sessions

Mitigation:
- deterministic child-session lookup by supervisor + domain
- idempotent work-item creation rules

### Risk: supervisor feed becomes too noisy

Mitigation:
- child internal chatter stays in child sessions
- supervisor feed only mirrors summaries and actionable state

### Risk: top strip and continue cards drift from runtime state again

Mitigation:
- UI reads only composite workflow projection for supervisor sessions
- no feed/draft heuristics in supervisor mode

## Definition of Done

- generic intake powers child-session clarification flows
- supervisor session and child sessions persist across reloads
- cross-domain input can decompose into several work items
- UI shows current active child item and sibling progress
- cancellation and resume are deterministic
- regression suite and build pass
- no football wording leaks into project ops prompts in the supervisor path
