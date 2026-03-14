# Subject-First Platform Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor MatchFlow from a football-first, match-first product into a subject-first platform that can onboard one structurally different second domain without rewriting the manager core, automation loop, or primary navigation model.

**Architecture:** Keep the shipped manager closed-loop foundation and runtime domain pack contract, but move the remaining match-shaped assumptions out of shared platform layers. Core platform code should only understand canonical subject, event, signal, workflow, and route contracts. Each domain should own subject detail rendering, domain-specific analysis config, source capability assembly, and manager tools through explicit adapters.

**Tech Stack:** React, TypeScript, Vite, local-first storage, existing manager-gateway/runtime-pack architecture, Vitest.

---

## Why This Plan Exists

The current architecture is in a transitional state:

1. The outer shell is already moving toward domain-neutral runtime packs.
2. The inner data model, detail page, source pipeline, and manager planning are still strongly football-first.
3. That means MatchFlow is ready for nearby football variants, but not yet ready for a structurally different domain such as project operations, generic task orchestration, stocks, or macro research.

The next milestone should therefore be:

`platform hardening first, second domain second`

Do not start with a direct "build stocks domain" slice.
That would bury platform debt under domain-specific code and make the architecture harder to recover later.

## Current Readiness Assessment

Current readiness for a clearly different domain is roughly `40%-45%`.

What is already reusable:

1. `src/domains/runtime/types.ts`
2. `src/domains/runtime/registry.ts`
3. `src/domains/runtime/automation.ts`
4. `src/services/manager-workspace/projection.ts`
5. `src/services/domains/ui/registry.ts`
6. `src/services/domains/ui/themeRegistry.ts`

What is still blocking second-domain onboarding:

1. `src/services/subjectDisplay.ts` is still a `SubjectDisplayMatch` alias.
2. `src/services/domains/types.ts` and `src/services/domains/modules/types.ts` still depend on match-shaped data.
3. `src/services/dataSources.ts` and `src/services/analysisConfig.ts` still assume `match`.
4. `src/pages/MatchDetail.tsx` is still the real subject detail workspace.
5. `src/services/manager/toolRegistry.ts` and `src/services/manager/llmPlanner.ts` still embed football semantics.
6. Several defaults still silently fall back to `football`.

## Non-Goals

This plan intentionally does not include:

1. Cloud sync, multi-user collaboration, or permissions.
2. Arbitrary third-party runtime code loading.
3. A big-bang rewrite of the current automation executor.
4. Production-grade stocks or macro market-data integration in the same wave.
5. Replacing the current football experience before feature parity is preserved.

## Recommended Second-Domain Pilot

Recommended pilot domain: `project_ops`

Reasoning:

1. It is structurally different from football.
2. It validates subject, timeline, workflow, and status modeling without hiding architecture work behind market-data complexity.
3. It is safer than using `stocks` as the first non-football pilot, because stocks introduce external quote, market-hours, and symbol-resolution complexity that would blur platform validation.

Fallback option if business priority changes:

1. `generic_task` is acceptable as a lighter pilot.
2. `stocks` should wait until Task 6 is complete.

## End-State Definition

The platform is ready for the next domain when all of the following are true:

1. Core services no longer require `match` to represent a subject.
2. Detail pages are mounted through a domain-owned subject workspace registry.
3. Analysis config and source selection are resolved through domain capabilities, not match-only helpers.
4. Manager planning and tool selection are driven by runtime pack metadata and registrations.
5. History, saved subjects, settings, and navigation no longer silently default to `football`.
6. A new domain can be onboarded through a documented checklist plus contract tests.
7. One structurally different pilot domain is shipped without patching shared core code for domain-specific behavior.

## Milestones

### Milestone A: Subject-first platform seam

Scope:

1. Task 1
2. Task 2
3. Task 3

Done means:

1. Shared types and detail routing are no longer match-shaped.
2. Football still renders through the new subject-first seam.

### Milestone B: Manager and platform neutralization

Scope:

1. Task 4
2. Task 5
3. Task 6

Done means:

1. Manager, settings, history, and onboarding no longer require football-specific fallback behavior.
2. New domain registration fails loudly when required capabilities are missing.

### Milestone C: Second-domain proof

Scope:

1. Task 7

Done means:

1. One structurally different domain ships on the same platform seams without shared-core hacks.

---

### Task 1: Freeze canonical subject contracts and remove `Match` alias leakage

**Why this exists**

The current system still treats the subject model as a renamed football match model. Until that changes, every new domain will be forced to imitate a match even when the real entity shape is different.

**Files:**
- Create: `src/services/subjects/types.ts`
- Create: `src/services/subjects/display.ts`
- Modify: `src/services/subjectDisplay.ts`
- Modify: `src/services/subjectDisplayMatch.ts`
- Modify: `src/services/domains/types.ts`
- Modify: `src/services/domains/modules/types.ts`
- Modify: `src/services/domains/builtinModules.ts`
- Test: `src/services/__tests__/subjectDisplay.test.ts`
- Test: `src/services/domains/__tests__/subjectContracts.test.ts`

**Design target**

```ts
export interface SubjectDisplayBase {
  domainId: string;
  subjectType: string;
  subjectId: string;
  title: string;
  status?: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
}

export interface DomainSubjectSnapshot {
  ref: {
    domainId: string;
    subjectType: string;
    subjectId: string;
  };
  display: SubjectDisplayBase;
  raw?: Record<string, unknown>;
}
```

**Step 1: Write the failing tests**

Run:

```bash
npx vitest run src/services/__tests__/subjectDisplay.test.ts src/services/domains/__tests__/subjectContracts.test.ts
```

Expected:

1. Fail because generic subject display helpers do not exist yet.
2. Fail because domain contract tests still require `SubjectDisplayMatch`.

**Step 2: Implement the minimal subject-first contract**

Implementation notes:

1. Shared contracts must only depend on domain-neutral subject metadata.
2. Football-specific display fields remain in football-owned helpers, not in shared platform types.
3. `SubjectDisplayMatch` becomes a football-specific extension, not the shared root type.

**Step 3: Run focused tests**

Run:

```bash
npx vitest run src/services/__tests__/subjectDisplay.test.ts src/services/domains/__tests__/subjectContracts.test.ts
```

Expected: PASS

**Step 4: Run impacted existing tests**

Run:

```bash
npx vitest run src/pages/matchDetail/__tests__/useAnalysisRuntime.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/subjects/types.ts src/services/subjects/display.ts src/services/subjectDisplay.ts src/services/subjectDisplayMatch.ts src/services/domains/types.ts src/services/domains/modules/types.ts src/services/domains/builtinModules.ts src/services/__tests__/subjectDisplay.test.ts src/services/domains/__tests__/subjectContracts.test.ts
git commit -m "refactor: introduce subject-first shared contracts"
```

**Done means**

1. Shared domain contracts no longer import `SubjectDisplayMatch`.
2. Football keeps its richer display model without leaking it into core interfaces.

**Can defer**

1. Perfect normalization of every historical football display field.

---

### Task 2: Replace the match-owned detail page with a domain-owned subject workspace

**Why this exists**

`MatchDetail.tsx` is currently the real subject detail page for the whole product. As long as the detail experience is match-owned, every new domain will either fork the page or inject domain logic into football UI code.

**Files:**
- Create: `src/pages/subject/SubjectDetailPage.tsx`
- Create: `src/pages/subject/useSubjectDetailState.ts`
- Create: `src/services/domains/ui/detailRegistry.ts`
- Create: `src/services/domains/ui/detailAdapters/footballDetailAdapter.ts`
- Modify: `src/pages/MatchDetail.tsx`
- Modify: `src/App.tsx`
- Modify: `src/services/navigation/subjectRoute.ts`
- Test: `src/pages/subject/__tests__/subjectDetailPage.test.tsx`
- Test: `src/services/navigation/__tests__/subjectRoute.test.ts`

**Design target**

```ts
export interface DomainSubjectDetailAdapter {
  domainId: string;
  canRender(subjectType: string): boolean;
  buildViewModel(input: SubjectDetailInput): Promise<SubjectDetailViewModel>;
}
```

**Step 1: Write the failing tests**

Run:

```bash
npx vitest run src/pages/subject/__tests__/subjectDetailPage.test.tsx src/services/navigation/__tests__/subjectRoute.test.ts
```

Expected:

1. Fail because there is no generic subject detail page.
2. Fail because route resolution still points directly at match-first assumptions.

**Step 2: Introduce the generic page and adapter registry**

Implementation notes:

1. `MatchDetail.tsx` should become a compatibility shell or delegate.
2. Shared route resolution should emit canonical subject refs.
3. Football UI behavior must be preserved by the football detail adapter.

**Step 3: Run focused tests**

Run:

```bash
npx vitest run src/pages/subject/__tests__/subjectDetailPage.test.tsx src/services/navigation/__tests__/subjectRoute.test.ts
```

Expected: PASS

**Step 4: Run regression tests for existing detail behavior**

Run:

```bash
npx vitest run src/pages/matchDetail/__tests__/useAnalysisRuntime.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/subject/SubjectDetailPage.tsx src/pages/subject/useSubjectDetailState.ts src/services/domains/ui/detailRegistry.ts src/services/domains/ui/detailAdapters/footballDetailAdapter.ts src/pages/MatchDetail.tsx src/App.tsx src/services/navigation/subjectRoute.ts src/pages/subject/__tests__/subjectDetailPage.test.tsx src/services/navigation/__tests__/subjectRoute.test.ts
git commit -m "refactor: mount subject detail through domain adapters"
```

**Done means**

1. Routing opens a subject page, not a football page pretending to be generic.
2. Football detail UI is mounted through a domain adapter.

**Can defer**

1. Deep visual redesign of the detail page.

---

### Task 3: Make analysis config and data-source resolution subject-aware

**Why this exists**

The current source and planning pipeline still treats `match` as the only analyzable object. That blocks onboarding for any domain whose data sources, input forms, or planning metadata are not match-shaped.

**Files:**
- Create: `src/services/analysisConfigRegistry.ts`
- Modify: `src/services/analysisConfig.ts`
- Modify: `src/services/dataSources.ts`
- Modify: `src/pages/dataSources/analysisDataWorkspaceModel.ts`
- Modify: `src/pages/matchDetail/useEditableSourceForm.tsx`
- Modify: `src/services/domains/types.ts`
- Test: `src/services/__tests__/analysisConfig.test.ts`
- Test: `src/services/__tests__/dataSources.test.ts`
- Test: `src/pages/dataSources/__tests__/analysisDataWorkspaceModel.test.ts`

**Design target**

```ts
export interface DomainAnalysisConfigAdapter {
  domainId: string;
  fetchSubjectConfig(subjectRef: {
    domainId: string;
    subjectType: string;
    subjectId: string;
  }): Promise<SubjectAnalysisConfigPayload | null>;
  mergePlanning(
    subjectPayload: unknown,
    config: SubjectAnalysisConfigPayload | null,
  ): unknown;
}
```

**Step 1: Write the failing tests**

Run:

```bash
npx vitest run src/services/__tests__/analysisConfig.test.ts src/services/__tests__/dataSources.test.ts src/pages/dataSources/__tests__/analysisDataWorkspaceModel.test.ts
```

Expected:

1. Fail because subject-aware config adapters do not exist.
2. Fail because current config fetch logic rejects non-match subject types.

**Step 2: Implement registry-based analysis config resolution**

Implementation notes:

1. Shared `analysisConfig.ts` becomes an orchestration layer, not a match-only implementation.
2. Football config stays supported through a football adapter.
3. Shared data-source capabilities must be built from domain-provided source definitions.

**Step 3: Run focused tests**

Run:

```bash
npx vitest run src/services/__tests__/analysisConfig.test.ts src/services/__tests__/dataSources.test.ts src/pages/dataSources/__tests__/analysisDataWorkspaceModel.test.ts
```

Expected: PASS

**Step 4: Run broader domain regression**

Run:

```bash
npx vitest run src/pages/matchDetail/__tests__/useAnalysisRuntime.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/analysisConfigRegistry.ts src/services/analysisConfig.ts src/services/dataSources.ts src/pages/dataSources/analysisDataWorkspaceModel.ts src/pages/matchDetail/useEditableSourceForm.tsx src/services/domains/types.ts src/services/__tests__/analysisConfig.test.ts src/services/__tests__/dataSources.test.ts src/pages/dataSources/__tests__/analysisDataWorkspaceModel.test.ts
git commit -m "refactor: make analysis config subject-aware"
```

**Done means**

1. Shared config and source resolution no longer reject non-match subjects.
2. Each domain can define how planning metadata and editable source forms are assembled.

**Can defer**

1. Server-side config endpoints for non-football domains.

---

### Task 4: Move manager planning and tool selection onto runtime-pack registrations

**Why this exists**

The manager closed loop is one of the strongest reusable assets in the product, but it still embeds football semantics in tool declarations, intent handling, and clarification defaults. That prevents the manager from becoming the universal entrypoint for future domains.

**Files:**
- Create: `src/services/manager/runtimeToolRegistry.ts`
- Create: `src/services/manager/runtimeIntentRouter.ts`
- Modify: `src/services/manager/toolRegistry.ts`
- Modify: `src/services/manager/llmPlanner.ts`
- Modify: `src/services/manager-gateway/legacyCompat.ts`
- Modify: `src/domains/runtime/automation.ts`
- Modify: `src/services/automation/domainParsers.ts`
- Test: `src/services/__tests__/managerToolRegistry.test.ts`
- Test: `src/services/__tests__/managerLlmPlanner.test.ts`
- Test: `src/services/__tests__/managerLegacyCompat.test.ts`

**Design target**

```ts
export interface RuntimeManagerCapability {
  domainId: string;
  tools: DomainToolDefinition[];
  plannerHints?: {
    helpText: string[];
    defaultWorkflowType?: string;
  };
}
```

**Step 1: Write the failing tests**

Run:

```bash
npx vitest run src/services/__tests__/managerToolRegistry.test.ts src/services/__tests__/managerLlmPlanner.test.ts src/services/__tests__/managerLegacyCompat.test.ts
```

Expected:

1. Fail when manager registry is asked to operate without football defaults.
2. Fail when planner selection still relies on football-specific tool ids or wording.

**Step 2: Introduce runtime-driven manager capability registration**

Implementation notes:

1. Shared manager files should discover tools from the runtime registry.
2. Football clarification copy remains football-owned.
3. `legacyCompat.ts` should map old consumers onto runtime-pack capabilities rather than onto football assumptions.

**Step 3: Run focused tests**

Run:

```bash
npx vitest run src/services/__tests__/managerToolRegistry.test.ts src/services/__tests__/managerLlmPlanner.test.ts src/services/__tests__/managerLegacyCompat.test.ts
```

Expected: PASS

**Step 4: Run automation bridge regression**

Run:

```bash
npx vitest run src/services/__tests__/automationExecutionSettings.test.ts src/pages/command/__tests__/feedAdapter.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/manager/runtimeToolRegistry.ts src/services/manager/runtimeIntentRouter.ts src/services/manager/toolRegistry.ts src/services/manager/llmPlanner.ts src/services/manager-gateway/legacyCompat.ts src/domains/runtime/automation.ts src/services/automation/domainParsers.ts src/services/__tests__/managerToolRegistry.test.ts src/services/__tests__/managerLlmPlanner.test.ts src/services/__tests__/managerLegacyCompat.test.ts
git commit -m "refactor: plug manager planning into runtime packs"
```

**Done means**

1. Manager planning does not need football-specific code in shared files.
2. A new domain can register tools and clarification behavior through runtime capabilities.

**Can defer**

1. Multi-tool recursive manager orchestration.

---

### Task 5: Remove silent `football` defaults from shared app state and persistence

**Why this exists**

Even after contracts are generalized, hidden defaults will keep dragging the product back to football behavior. This is the class of issue that makes second-domain support appear implemented while still failing at runtime.

**Files:**
- Modify: `src/contexts/AnalysisContext.tsx`
- Modify: `src/services/settings.ts`
- Modify: `src/services/history.ts`
- Modify: `src/services/savedSubjects.ts`
- Modify: `src/services/navigation/subjectRoute.ts`
- Modify: `src/services/automation/executionSettings.ts`
- Test: `src/services/__tests__/settings.test.ts`
- Test: `src/services/__tests__/historyResumeRecoverability.test.ts`
- Test: `src/services/__tests__/savedSubjects.test.ts`
- Test: `src/services/navigation/__tests__/subjectRoute.test.ts`

**Step 1: Write the failing tests**

Run:

```bash
npx vitest run src/services/__tests__/settings.test.ts src/services/__tests__/historyResumeRecoverability.test.ts src/services/__tests__/savedSubjects.test.ts src/services/navigation/__tests__/subjectRoute.test.ts
```

Expected:

1. Fail because some stores still assume `football` when domain id is missing.
2. Fail because history and saved subject recovery cannot round-trip a generic subject reference.

**Step 2: Replace hidden defaults with explicit subject refs and resolution rules**

Implementation notes:

1. Persist canonical subject refs everywhere possible.
2. If a default is required, it should be resolved from active workspace or explicit settings, not hardcoded.
3. Fail loudly in development when a domain id is required but missing.

**Step 3: Run focused tests**

Run:

```bash
npx vitest run src/services/__tests__/settings.test.ts src/services/__tests__/historyResumeRecoverability.test.ts src/services/__tests__/savedSubjects.test.ts src/services/navigation/__tests__/subjectRoute.test.ts
```

Expected: PASS

**Step 4: Run affected manager and detail regressions**

Run:

```bash
npx vitest run src/services/__tests__/managerLegacyCompat.test.ts src/pages/matchDetail/__tests__/useAnalysisRuntime.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/contexts/AnalysisContext.tsx src/services/settings.ts src/services/history.ts src/services/savedSubjects.ts src/services/navigation/subjectRoute.ts src/services/automation/executionSettings.ts src/services/__tests__/settings.test.ts src/services/__tests__/historyResumeRecoverability.test.ts src/services/__tests__/savedSubjects.test.ts src/services/navigation/__tests__/subjectRoute.test.ts
git commit -m "refactor: remove football defaults from shared state"
```

**Done means**

1. Shared persistence and routing layers no longer inject football silently.
2. Subject history, saved items, and resume recovery are domain-aware by design.

**Can defer**

1. One-time migration of every old local record, as long as compatibility reads remain.

---

### Task 6: Harden domain onboarding with validators, contracts, and checklists

**Why this exists**

Without onboarding guardrails, every future domain will repeat the same manual wiring and hidden omissions. Platform readiness is not real until a new domain can be added through a predictable checklist and contract validation.

**Files:**
- Create: `src/domains/runtime/validators.ts`
- Create: `src/domains/runtime/onboarding.ts`
- Create: `docs/client/45-domain-onboarding-checklist-2026-03-14.md`
- Modify: `src/domains/runtime/registry.ts`
- Modify: `src/services/domains/builtinModules.ts`
- Modify: `src/services/automation/domainParsers.ts`
- Test: `src/domains/runtime/__tests__/registryContract.test.ts`
- Test: `src/services/domains/__tests__/builtinModules.test.ts`

**Design target**

```ts
export interface DomainOnboardingCheck {
  domainId: string;
  hasRuntimePack: boolean;
  hasDetailAdapter: boolean;
  hasAnalysisConfigAdapter: boolean;
  hasAutomationParser: boolean;
  hasContractTests: boolean;
}
```

**Step 1: Write the failing tests**

Run:

```bash
npx vitest run src/domains/runtime/__tests__/registryContract.test.ts src/services/domains/__tests__/builtinModules.test.ts
```

Expected:

1. Fail because registry validation is permissive.
2. Fail because builtin modules can still be registered with incomplete second-domain support.

**Step 2: Implement onboarding validators**

Implementation notes:

1. Runtime registration should validate required adapters in development and tests.
2. Missing capabilities should produce explicit diagnostics.
3. The checklist document should define the minimum bar for a new domain.

**Step 3: Run focused tests**

Run:

```bash
npx vitest run src/domains/runtime/__tests__/registryContract.test.ts src/services/domains/__tests__/builtinModules.test.ts
```

Expected: PASS

**Step 4: Run cross-cutting regression**

Run:

```bash
npx vitest run src/services/__tests__/managerToolRegistry.test.ts src/services/__tests__/managerLegacyCompat.test.ts src/pages/dataSources/__tests__/analysisDataWorkspaceModel.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/domains/runtime/validators.ts src/domains/runtime/onboarding.ts docs/client/45-domain-onboarding-checklist-2026-03-14.md src/domains/runtime/registry.ts src/services/domains/builtinModules.ts src/services/automation/domainParsers.ts src/domains/runtime/__tests__/registryContract.test.ts src/services/domains/__tests__/builtinModules.test.ts
git commit -m "chore: harden domain onboarding contracts"
```

**Done means**

1. Domain onboarding is explicit and testable.
2. Incomplete domain registration fails before runtime surprises reach the UI.

**Can defer**

1. CLI tooling for scaffolding domain modules.

---

### Task 7: Ship one structurally different pilot domain on the hardened platform

**Why this exists**

The hardening work is only proven when one non-football domain ships without requiring shared-core exceptions. This task validates the platform and determines whether MatchFlow is ready to scale past one domain.

**Recommended pilot:** `project_ops`

**Files:**
- Create: `src/domains/runtime/projectOps/index.ts`
- Create: `src/domains/runtime/projectOps/manifest.ts`
- Create: `src/domains/runtime/projectOps/resolver.ts`
- Create: `src/domains/runtime/projectOps/context.ts`
- Create: `src/domains/runtime/projectOps/tools.ts`
- Create: `src/domains/runtime/projectOps/workflows.ts`
- Create: `src/services/domains/ui/detailAdapters/projectOpsDetailAdapter.ts`
- Modify: `src/domains/runtime/registry.ts`
- Modify: `src/services/domains/ui/registry.ts`
- Modify: `src/App.tsx`
- Test: `src/domains/runtime/projectOps/__tests__/index.test.ts`
- Test: `src/services/__tests__/managerLegacyCompat.test.ts`
- Test: `src/pages/subject/__tests__/subjectDetailPage.test.tsx`

**Pilot model**

```ts
type ProjectOpsSubjectType = "project" | "task" | "initiative";
type ProjectOpsEventType = "deadline" | "review" | "handoff";
```

**Step 1: Write the failing tests**

Run:

```bash
npx vitest run src/domains/runtime/projectOps/__tests__/index.test.ts src/services/__tests__/managerLegacyCompat.test.ts src/pages/subject/__tests__/subjectDetailPage.test.tsx
```

Expected:

1. Fail because the second domain is not registered.
2. Fail because the manager and subject detail page cannot mount a non-football domain end to end.

**Step 2: Implement the pilot domain pack**

Implementation notes:

1. Keep the pilot intentionally small.
2. Focus on proving subject detail, manager intake, history, saved subject, and analysis config wiring.
3. Do not add advanced reporting or external integrations in the same slice.

**Step 3: Run focused tests**

Run:

```bash
npx vitest run src/domains/runtime/projectOps/__tests__/index.test.ts src/services/__tests__/managerLegacyCompat.test.ts src/pages/subject/__tests__/subjectDetailPage.test.tsx
```

Expected: PASS

**Step 4: Run release candidate regression**

Run:

```bash
npx vitest run src/services/__tests__/managerToolRegistry.test.ts src/services/__tests__/managerLlmPlanner.test.ts src/services/__tests__/managerLegacyCompat.test.ts src/pages/matchDetail/__tests__/useAnalysisRuntime.test.ts src/pages/dataSources/__tests__/analysisDataWorkspaceModel.test.ts
npm run build
```

Expected:

1. All targeted tests PASS.
2. Build succeeds.

**Step 5: Commit**

```bash
git add src/domains/runtime/projectOps src/services/domains/ui/detailAdapters/projectOpsDetailAdapter.ts src/domains/runtime/registry.ts src/services/domains/ui/registry.ts src/App.tsx src/domains/runtime/projectOps/__tests__/index.test.ts src/services/__tests__/managerLegacyCompat.test.ts src/pages/subject/__tests__/subjectDetailPage.test.tsx
git commit -m "feat: add project operations as second subject domain"
```

**Done means**

1. A structurally different domain works through the same subject detail, manager, routing, config, and persistence seams.
2. Football still works without special-case rollback code.

**Can defer**

1. Advanced project dashboards.
2. External SaaS sync.

---

## Sequencing Rules

Follow this order exactly:

1. Task 1 before everything else.
2. Task 2 and Task 3 can overlap after Task 1 lands.
3. Task 4 starts only after Task 1 is stable.
4. Task 5 must land before Task 7.
5. Task 6 must land before choosing `stocks` or `macro` as a pilot.
6. Task 7 is the proof, not the place to continue refactoring shared contracts.

## Risk Register

### Risk 1: Over-generalization stalls delivery

Mitigation:

1. Generalize only the platform seams already proven necessary by current blockers.
2. Keep football as the reference implementation for every new seam.

### Risk 2: Shared core still leaks football through defaults

Mitigation:

1. Add explicit tests for missing-domain behavior.
2. Remove silent fallback wherever possible.

### Risk 3: The second domain becomes a hidden platform rewrite

Mitigation:

1. Finish Tasks 1-6 first.
2. Reject pilot-domain changes that require new shared-core exceptions.

## Exit Metrics

By the end of Task 6, target readiness for a clearly different domain should rise from `40%-45%` to roughly `80%-85%`.

By the end of Task 7, MatchFlow should be able to claim:

1. One football domain and one structurally different domain share the same manager entrypoint.
2. One football domain and one structurally different domain share the same routing and history model.
3. Shared core code no longer assumes the subject is a match.

## Final Development Endpoint

The development endpoint for this wave is not "many domains".

It is:

`one stable football domain + one structurally different second domain + a platform seam that can onboard the third domain without reopening core architecture`

That is the correct place to stop, evaluate, and then decide whether the third domain should be `stocks`, `macro`, `generic_task`, or something else.
