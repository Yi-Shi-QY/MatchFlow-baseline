# Manager Generic Intake Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the manager agent task-intake flow into a domain-agnostic slot-based architecture so structurally different domains like football, project ops, stocks, macro, and generic tasks can share the same orchestration core without inheriting football semantics.

**Architecture:** Move the manager from a hardcoded `factors + sequence` intake model to a generic intake workflow engine driven by per-domain intake definitions. The manager core should only orchestrate steps, track slot completion, render follow-up prompts, and hand off to the active runtime domain to parse, validate, and finalize drafts.

**Tech Stack:** TypeScript, runtime domain packs, manager gateway, projection-first command center, Vitest

---

## Problem Summary

The current second-domain failure is not a UI bug. It is an architecture leak:

- The manager core still hardcodes football semantics through `fundamental | market | custom | prediction`.
- Workflow state is hardcoded as `await_factors | await_sequence`.
- Clarification parsing and follow-up prompts are shared, but the shared layer is actually football-specific.
- `project_ops` can switch entry, subject, and workbench, but once the intake workflow starts, it falls back into football language like "赔率盘口".

This means the system is not yet truly multi-domain. It is a football-first manager with partial domain-aware wrappers.

## Requirements

### Functional

- The manager must support domains whose intake structures differ materially.
- The core must no longer assume every domain has analysis factors and sequence.
- The command center home strip, conversation thread, and workflow state must all read the same generic workflow metadata.
- Domains must be able to define their own:
  - required slots
  - parsing rules
  - follow-up prompts
  - retry prompts
  - completion rules
  - draft finalization logic

### Non-Functional

- Preserve the current conversation-first UX.
- Keep the migration incremental so football continues to work while project ops is upgraded.
- Avoid breaking existing session projection and automation draft activation.
- Make the next non-football domain extension cheaper, not just possible.

## Alternatives

### Option A: Patch wording only

Replace football labels inside `project_ops` prompts.

Why not:
- Fast but wrong.
- Does not solve the hardcoded state machine.
- The next structurally different domain fails again.

### Option B: Domain-specific wrappers over current `factors + sequence` model

Keep the current manager core, but let each domain rename the two steps and their labels.

Why not:
- Better than A, but still assumes all domains share the same two-slot intake shape.
- Still forces stocks, macro, or generic tasks into football's conceptual model.

### Option C: Generic slot-based intake engine

Represent intake as a workflow with domain-defined steps and slots.

Why this is the recommended option:
- Removes football semantics from the core.
- Lets each domain define its own task-intake contract.
- Unifies conversation prompts, workflow projection, and UI status cards.
- Creates a reusable base for future domains.

## Recommended Architecture

### 1. Manager Core Becomes an Intake Orchestrator

The manager core should no longer understand domain concepts such as:

- factors
- sequence
- prediction
- await_factors
- await_sequence

Instead it should handle only:

- current workflow id
- current step id
- missing slot ids
- recognized slot values
- next prompt metadata
- finalization request to the active domain capability

### 2. Each Domain Provides a `taskIntake` Capability

Add a new capability under runtime manager support:

- `taskIntake.definition`
- `taskIntake.prepare`
- `taskIntake.resume`
- `taskIntake.describe`
- `taskIntake.projectWorkflow`

The domain owns business meaning. The manager owns orchestration.

### 3. Replace `ManagerPendingTask` with a Generic Workflow Snapshot

Current shape is too football-specific. Replace it with a generic state model such as:

```ts
interface ManagerIntakeWorkflowState {
  workflowId: string;
  workflowType: string;
  domainId: string;
  sourceText: string;
  composerMode: AutomationCommandComposerMode;
  drafts: AutomationDraft[];
  activeStepId: string | null;
  steps: IntakeStepProgress[];
  slotValues: Record<string, IntakeResolvedValue>;
  missingSlotIds: string[];
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

interface IntakeStepProgress {
  stepId: string;
  status: 'pending' | 'active' | 'completed';
  slotIds: string[];
  summary?: string;
}
```

This lets football use `analysis_dimensions` and `analysis_sequence`, while project ops can use `focus_dimensions`, `decision_goal`, and `time_horizon`.

### 4. Follow-Up Prompts Become Metadata, Not Hardcoded Strings

The current shared prompt builder is the main leak. Replace it with domain-provided prompt descriptors:

```ts
interface RuntimeTaskIntakePromptSet {
  intro: RuntimeLocalizedText;
  askForStep(stepId: string, ctx: IntakePromptContext): RuntimeLocalizedText;
  retryStep(stepId: string, ctx: IntakePromptContext): RuntimeLocalizedText;
  summarizeRecognition?(ctx: IntakePromptContext): RuntimeLocalizedText | null;
}
```

The command center and manager thread should render the same prompt source instead of inventing their own text.

### 5. Parsing Moves Behind Domain Slot Definitions

Introduce a generic slot definition contract:

```ts
interface RuntimeTaskIntakeSlotDefinition {
  slotId: string;
  label: RuntimeLocalizedText;
  required: boolean;
  valueType: 'enum' | 'entity' | 'string' | 'number' | 'datetime' | 'list';
  parse(input: IntakeParseInput): IntakeSlotParseResult | null;
  format?(value: IntakeResolvedValue, language: 'zh' | 'en'): string;
}
```

This removes the current global parser assumptions:

- `parseSourcePreferenceIds`
- `parseSequencePreference`
- `ManagerSourcePreferenceId`
- `ManagerSequenceStepId`

Football can still keep these semantics, but they become football-owned slot parsers instead of manager-global concepts.

### 6. UI Status Reads Generic Workflow Metadata

The home strip should not infer "details needed" from draft clarifications only. It should read:

- active workflow
- active step label
- pending slot count
- resume action

This fixes the current mismatch where the conversation is in an unfinished intake step but the top strip says "上次流程已完成".

## Proposed Type Changes

### Modify

- `src/domains/runtime/types.ts`
  - add `RuntimeTaskIntakeCapability`
  - add `RuntimeTaskIntakeDefinition`
  - add `RuntimeTaskIntakeSlotDefinition`
  - add `RuntimeTaskIntakeWorkflowState`
- `src/services/manager/types.ts`
  - deprecate `ManagerSourcePreferenceId`
  - deprecate `ManagerSequenceStepId`
  - deprecate `ManagerPendingTask`
  - add generic intake workflow types
- `src/services/manager-gateway/types.ts`
  - ensure projection supports generic intake workflow metadata

### Create

- `src/services/manager-intake/types.ts`
- `src/services/manager-intake/runtime.ts`
- `src/services/manager-intake/promptBuilder.ts`
- `src/services/manager-intake/workflowProjection.ts`
- `src/services/manager-intake/legacyCompat.ts`

### Refactor

- `src/services/manager/toolRegistry.ts`
  - remove global football-oriented clarification logic
  - delegate task intake prepare/resume to generic engine
- `src/services/manager-workspace/clarificationSummary.ts`
  - replace with generic intake progress summarization
- `src/pages/command/homeLayoutModel.ts`
  - build continue cards from generic workflow metadata

### Domain Migration Targets

- `src/domains/runtime/football/manager.ts`
- `src/domains/runtime/football/tools.ts`
- `src/domains/runtime/projectOps/manager.ts`
- `src/domains/runtime/projectOps/tools.ts`

## Key Decision Records

### ADR-1: Remove football semantics from manager-core types

Decision:
- The core manager types must not encode football concepts.

Why:
- Core types define system boundaries. If the types are football-shaped, every new domain becomes an adapter hack.

Trade-off:
- Requires broader refactor now.
- Prevents repeated breakage later.

### ADR-2: Domain owns intake semantics, core owns orchestration

Decision:
- The runtime domain pack provides intake definitions and parsers.

Why:
- Only the domain knows what "complete enough to create a task" means.

Trade-off:
- Domain packages become slightly heavier.
- The manager becomes much more reusable.

### ADR-3: Workflow UI reads projected workflow metadata, not draft heuristics

Decision:
- Command center status must consume the same active workflow metadata used by conversation resume.

Why:
- Prevents UI from reporting "completed" while the workflow is still awaiting input.

Trade-off:
- Requires one extra projection layer.
- Greatly improves state consistency.

## Migration Strategy

### Phase 0: Freeze unsafe patching

Do not continue patching `project_ops` wording inside football-era shared helpers. Those patches increase divergence without fixing the core model.

### Phase 1: Introduce generic intake types and engine behind compatibility layer

Goal:
- Add the new generic architecture without breaking current runtime behavior.

Deliverables:
- Generic intake types
- Generic workflow engine
- Compatibility adapter that can still project football pending tasks into the old UI shape when needed

Exit criteria:
- No user-visible behavior change yet
- Tests compile against both old and new types during transition

### Phase 2: Migrate football to the new intake capability

Goal:
- Prove the new engine can preserve existing football behavior

Deliverables:
- Football slots: `analysis_dimensions`, `analysis_sequence`
- Football prompts and parsers live under football runtime domain files

Exit criteria:
- Football tests still pass
- No references to football wording remain in generic manager modules

### Phase 3: Migrate project ops to a genuinely different intake schema

Goal:
- Validate structural extensibility, not just renaming

Suggested project ops slots:
- `target_subject`
- `focus_dimensions`
- `decision_goal`
- `time_horizon`

Exit criteria:
- Project ops intake no longer says "赔率盘口"
- Project ops can complete task creation through domain-native prompts

### Phase 4: Rewire UI status and continue cards to generic workflow metadata

Goal:
- Top strip, continue card, and conversation state all align

Exit criteria:
- No more "上次流程已完成" while an intake step is still pending
- Continue card uses domain-native step title and resume action

### Phase 5: Remove legacy football-specific clarification core

Goal:
- Delete the old shared parser/prompt layer after both football and project ops use the new engine

Exit criteria:
- Remove:
  - `ManagerSourcePreferenceId`
  - `ManagerSequenceStepId`
  - football-only prompt builders from manager core

## Task Breakdown

### Task 1: Introduce generic intake contracts

**Files:**
- Create: `src/services/manager-intake/types.ts`
- Modify: `src/domains/runtime/types.ts`
- Modify: `src/services/manager/types.ts`
- Test: `src/services/__tests__/managerIntakeTypes.test.ts`

**Success criteria:**
- Generic types compile
- Existing modules can reference the new types without changing behavior yet

### Task 2: Build the generic intake engine

**Files:**
- Create: `src/services/manager-intake/runtime.ts`
- Create: `src/services/manager-intake/promptBuilder.ts`
- Create: `src/services/manager-intake/workflowProjection.ts`
- Test: `src/services/__tests__/managerIntakeRuntime.test.ts`

**Success criteria:**
- Engine can prepare a workflow, apply a user answer, compute missing slots, and emit follow-up metadata

### Task 3: Add runtime domain intake capability

**Files:**
- Modify: `src/domains/runtime/football/manager.ts`
- Modify: `src/domains/runtime/projectOps/manager.ts`
- Modify: `src/domains/runtime/types.ts`
- Test: `src/domains/runtime/projectOps/__tests__/index.test.ts`
- Test: `src/services/__tests__/footballRuntimePack.test.ts`

**Success criteria:**
- Football and project ops expose domain-owned intake definitions

### Task 4: Rewire manager prepare/resume to the generic engine

**Files:**
- Modify: `src/services/manager/toolRegistry.ts`
- Modify: `src/domains/runtime/football/tools.ts`
- Modify: `src/domains/runtime/projectOps/tools.ts`
- Test: `src/services/__tests__/managerRuntime.test.ts`
- Test: `src/services/__tests__/managerGatewaySubmit.test.ts`

**Success criteria:**
- Manager task preparation and continuation use the generic engine end-to-end

### Task 5: Rewire command center status to workflow metadata

**Files:**
- Modify: `src/pages/command/homeLayoutModel.ts`
- Modify: `src/services/manager-gateway/legacyCompat.ts`
- Test: `src/pages/command/__tests__/homeLayoutModel.test.ts`

**Success criteria:**
- Top status reflects active intake workflow state
- Continue cards use domain-native step labels

### Task 6: Remove football-only manager core helpers

**Files:**
- Modify: `src/services/managerAgent.ts`
- Modify: `src/services/manager-workspace/clarificationSummary.ts`
- Remove or deprecate football-only exports after migration
- Test: `src/services/__tests__/managerClarificationParser.test.ts`

**Success criteria:**
- Generic manager modules contain no football business language

## Test Strategy

### Required

- Domain-agnostic intake engine unit tests
- Football regression tests for current factors and sequence flow
- Project ops tests proving project-native prompts and completion path
- Command center layout tests proving top strip follows active workflow state
- Manager gateway tests proving session projection round-trips the new workflow model

### Must-have user-visible assertions

- Project ops prompt does not contain `赔率盘口`
- Project ops prompt does not contain football-specific factor labels
- Home strip does not show `上次流程已完成` while intake is pending
- Tool-result authored text is not duplicated by planner recap

## Risks

- Type migration touches many files and may cause temporary dual-model complexity
- Legacy tests may assume `ManagerPendingTask`
- Draft generation may still rely on analysis-profile assumptions in automation layer

## Risk Mitigation

- Introduce compatibility adapters first
- Migrate football before deleting old helpers
- Keep UI projection backward-compatible during the transition
- Split the rollout into architecture-first, football migration, project ops migration, cleanup

## Explicit Out of Scope for Phase 1

- New domain creation beyond football and project ops
- Full redesign of automation draft schema
- General LLM planner rewrite
- Mobile gesture/navigation polish unrelated to intake state

## Recommended Immediate Next Step

Start with Phase 1 and Phase 2 only. The first milestone is not "project ops wording fixed". The first milestone is "football also runs on the new generic engine". Once football survives on the new abstraction, migrate project ops as the proof of structural flexibility.
