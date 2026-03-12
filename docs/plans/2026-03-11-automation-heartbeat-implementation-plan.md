# MatchFlow Automation Heartbeat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first automation system for MatchFlow that supports natural-language task creation, clarification, scheduled execution, background-capable Android/runtime hosts, and task-level parallel automation across domains without introducing server-side scheduling.

**Architecture:** Add a first-class `/automation` route, persist drafts/rules/jobs/runs locally, extract the current analysis pipeline into a non-UI execution runtime, and layer an exact-time scheduler plus heartbeat reconciliation over a task queue with system-managed concurrency budgets.

**Tech Stack:** React 19, Vite, Capacitor, TypeScript, Capacitor SQLite, Capacitor Local Notifications, existing MatchFlow analysis pipeline, Android native plugin/service extensions, desktop shell host integration later.

---

## Status Snapshot (2026-03-11)

Completed or substantially landed in the current branch:

1. Tasks 1-7
2. Task 8 core entry integration, with home-surface copy/styling polish still open
3. Tasks 9-17
4. Task 18 v1 Android native scheduling support
5. Task 19 v1 Android automation background execution host
6. Task 21 core automation test coverage

Current implementation highlights:

1. `/automation` is the unified natural-language entry for:
   - immediate analysis
   - automation creation
   - clarification and activation
2. Manual and automation execution now share the same runtime path and history/result pipeline.
3. Android background execution uses:
   - exact alarms
   - wake receiver bootstrapping
   - scope-based foreground execution for `analysis` and `automation`
4. Background automation defaults now favor resilience:
   - `resumeMode` defaults to `enabled`
   - retry flows resume by default
   - animations are disabled by default in background execution

Pending or partial after this round:

1. Task 8 home entry copy/polish follow-up
2. Task 19 device-QA-driven hardening and richer native telemetry
3. Task 20 desktop shell host abstraction
4. Task 22 deeper integration coverage across automation/manual reopen paths
5. Task 23 operator docs, troubleshooting docs, and release-facing guidance

Verification snapshot:

1. `npm.cmd run lint` passed
2. `npm.cmd run build` passed
3. `npm.cmd run test` passed with 17 files and 43 tests
4. Android native build truth is currently Android Studio on the device side; CLI Gradle wrapper in this environment remains unreliable because `android/gradle/wrapper/gradle-wrapper.jar` is corrupt here

## Implementation Notes

1. This plan is phased to de-risk Android background execution.
2. Do not start with Android wakeups.
3. First make automation data structures, UI, and non-UI execution flow work while the app is running.
4. Then add scheduling, heartbeat, and Android background host support.
5. Keep server responsibilities unchanged.

## Task 1: Create the automation module skeleton

**Files:**
- Create: `src/services/automation/`
- Create: `src/services/automation/types.ts`
- Create: `src/services/automation/index.ts`
- Create: `src/services/automation/constants.ts`

**Steps:**
1. Define core types for drafts, clarification state, rules, jobs, runs, schedules, selectors, execution policy, and notification policy.
2. Add constants for job states, draft states, trigger types, default retry windows, and default concurrency caps.
3. Export the new automation module entry points from `index.ts`.
4. Keep this file set type-only and side-effect free in the first commit.

**Verification:**
- Run: `npm.cmd run lint`
- Expected: new automation type definitions compile without unused import noise

## Task 2: Extend local DB schema for automation entities

**Files:**
- Modify: `src/services/db.ts`
- Create: `src/services/automation/migrations.ts`

**Steps:**
1. Add new SQLite tables:
   - `automation_drafts`
   - `automation_rules`
   - `automation_jobs`
   - `automation_runs`
2. Add indexes for:
   - draft status and updated time
   - rule enabled and next planned time
   - job state, scheduled time, retry time
   - run job id and start time
3. Add lightweight migration helpers for future schema evolution.
4. Ensure web fallback behavior still works without SQLite.

**Verification:**
- Run: `npm.cmd run lint`
- Manual check: no type regressions in `db.ts`

## Task 3: Build local stores for drafts, rules, jobs, and runs

**Files:**
- Create: `src/services/automation/draftStore.ts`
- Create: `src/services/automation/ruleStore.ts`
- Create: `src/services/automation/jobStore.ts`
- Create: `src/services/automation/runStore.ts`
- Create: `src/services/automation/storageFallback.ts`

**Steps:**
1. Implement CRUD for each entity.
2. Support SQLite-first, localStorage fallback behavior consistent with existing history/resume patterns.
3. Add helper queries:
   - list active rules
   - list upcoming jobs
   - list eligible jobs
   - list retryable jobs
   - list recent runs
4. Keep storage APIs deterministic and sync-shaped where practical.

**Verification:**
- Run: `npm.cmd run lint`
- Add targeted tests later once the module API stabilizes

## Task 4: Add automation parser and draft normalization layer

**Files:**
- Create: `src/services/automation/parser.ts`
- Create: `src/services/automation/normalizers.ts`
- Create: `src/services/automation/examples.ts`
- Modify: existing AI prompt/agent registration files as needed

**Steps:**
1. Create a dedicated automation parser prompt that returns structured draft JSON.
2. Support one command producing multiple drafts.
3. Normalize and validate parser output against internal task types.
4. Convert weak parser output into:
   - `ready`
   - `needs_clarification`
   - `rejected`
5. Seed example commands for mobile UX.

**Verification:**
- Run: `npm.cmd run lint`
- Add parser unit tests once the normalization contract is fixed

## Task 5: Add clarification state machine

**Files:**
- Create: `src/services/automation/clarification.ts`
- Create: `src/services/automation/clarificationRules.ts`

**Steps:**
1. Implement minimal-question clarification logic.
2. Support at most three clarification rounds.
3. Persist unanswered drafts.
4. Resolve common ambiguity classes:
   - unclear time
   - unclear domain
   - unclear match target
   - unclear recurring vs one-time mode
5. Make the engine data-driven enough to reuse from UI and future background recovery flows.

**Verification:**
- Run: `npm.cmd run lint`

## Task 6: Add target-resolution helpers using existing server/data paths

**Files:**
- Create: `src/services/automation/targetResolver.ts`
- Modify: `src/services/matchData.ts` as needed
- Modify: `src/services/analysisConfig.ts` only if shared helpers are needed

**Steps:**
1. Build a target resolver that uses existing match/data/config APIs.
2. Support selector modes:
   - `fixed_subject`
   - `league_query`
   - `server_resolve`
3. Return enough metadata for draft review before saving.
4. Avoid introducing server-side scheduling semantics.

**Verification:**
- Run: `npm.cmd run lint`

## Task 7: Add the `/automation` route and lazy page entry

**Files:**
- Modify: `src/App.tsx`
- Create: `src/pages/Automation.tsx`

**Steps:**
1. Register a lazy-loaded automation route.
2. Add notification deep-link support for automation draft/run navigation.
3. Keep routing compatible with existing app structure.

**Verification:**
- Run: `npm.cmd run lint`
- Run: `npm.cmd run build`

## Task 8: Add the home-page automation entry

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: domain UI presenter files only if entry styling must vary by domain

**Steps:**
1. Add a first-class automation entry on the home surface.
2. Make it mobile-friendly and easy to tap one-handed.
3. Do not bury it inside settings.
4. Keep current home analysis/history interactions intact.

**Verification:**
- Run: `npm.cmd run lint`
- Manual smoke: home page still navigates normally on mobile-sized viewport

## Task 9: Build the automation page shell

**Files:**
- Create: `src/pages/automation/AutomationCommandComposer.tsx`
- Create: `src/pages/automation/AutomationDraftList.tsx`
- Create: `src/pages/automation/AutomationClarificationSheet.tsx`
- Create: `src/pages/automation/AutomationTaskList.tsx`
- Create: `src/pages/automation/AutomationRunList.tsx`
- Create: `src/pages/automation/useAutomationPageState.ts`

**Steps:**
1. Split the page into focused mobile components.
2. Add a single command input.
3. Render draft cards with compact review fields.
4. Present clarification one question at a time in a bottom sheet or equivalent mobile modal.
5. Render upcoming tasks and recent runs in compact cards, not desktop-style tables.

**Verification:**
- Run: `npm.cmd run lint`
- Run: `npm.cmd run build`

## Task 10: Persist confirmed drafts into rules or one-time jobs

**Files:**
- Create: `src/services/automation/activation.ts`
- Modify: `src/pages/automation/useAutomationPageState.ts`

**Steps:**
1. Translate confirmed draft objects into saved recurring rules or one-time jobs.
2. Save unresolved drafts as inactive editable records.
3. Compute initial `nextPlannedAt` and recovery windows.
4. Keep activation explicit; no auto-activation on raw parser success.

**Verification:**
- Run: `npm.cmd run lint`

## Task 11: Extract a non-UI analysis execution runtime

**Files:**
- Create: `src/services/automation/executor.ts`
- Create: `src/services/automation/executionRuntime.ts`
- Modify: `src/contexts/AnalysisContext.tsx`
- Modify: `src/pages/matchDetail/useAnalysisRuntime.ts`
- Modify: `src/contexts/analysis/types.ts` if shared runtime types are needed

**Steps:**
1. Identify the minimal execution core currently embedded in `AnalysisContext`.
2. Move analysis start/run/finalize logic into a reusable service that does not require React context.
3. Preserve manual analysis behavior by adapting `AnalysisContext` to call the new service.
4. Ensure automated execution can emit:
   - runtime updates
   - state snapshots
   - history saves
   - failure metadata

**Verification:**
- Run: `npm.cmd run lint`
- Run: `npm.cmd run test`
- Manual smoke: manual analysis still works

## Task 12: Introduce automation job execution plumbing

**Files:**
- Modify: `src/services/automation/executor.ts`
- Create: `src/services/automation/jobAssembler.ts`
- Create: `src/services/automation/jobExecutionContext.ts`

**Steps:**
1. Build a job-to-analysis request assembler.
2. Resolve target snapshots and domain/template pinning before execution.
3. Launch the shared non-UI execution runtime for each job.
4. Persist job and run state transitions deterministically.
5. Save final outputs into existing history storage and store returned history IDs.

**Verification:**
- Run: `npm.cmd run lint`

## Task 13: Add queueing and concurrency budget management

**Files:**
- Create: `src/services/automation/queue.ts`
- Create: `src/services/automation/concurrencyBudget.ts`
- Create: `src/services/automation/providerBudget.ts`

**Steps:**
1. Build a queue that only parallelizes across jobs.
2. Keep single-job analysis internally sequential.
3. Add automatic concurrency budgeting based on host type and runtime conditions.
4. Add provider/model-level subcaps to prevent burst overload.
5. Expose queue snapshots for UI status.

**Verification:**
- Run: `npm.cmd run lint`
- Add focused tests for budget calculation and state transitions

## Task 14: Add scheduler and recurring-rule expansion

**Files:**
- Create: `src/services/automation/scheduler.ts`
- Create: `src/services/automation/ruleExpansion.ts`
- Create: `src/services/automation/time.ts`

**Steps:**
1. Compute next fire times for one-time and recurring rules.
2. Expand recurring rules into concrete jobs at eligible windows.
3. Avoid duplicate job creation for the same rule/window/target set.
4. Store enough metadata for replay and debugging.

**Verification:**
- Run: `npm.cmd run lint`

## Task 15: Add heartbeat reconciliation

**Files:**
- Create: `src/services/automation/heartbeat.ts`
- Create: `src/services/automation/recovery.ts`

**Steps:**
1. Scan for:
   - due pending jobs
   - retryable failed jobs
   - missed jobs inside recovery windows
   - stale running jobs
2. Move jobs into queue eligibility states.
3. Apply the agreed first-phase windows:
   - one-time: 30 minutes
   - recurring daily: same schedule window, not across day boundary
4. Keep heartbeat generic and domain-agnostic.

**Verification:**
- Run: `npm.cmd run lint`

## Task 16: Add automation notifications and deep links

**Files:**
- Modify: `src/App.tsx`
- Create: `src/services/automation/notifications.ts`
- Modify: `src/contexts/analysis/notificationAdapter.ts` if shared helpers should be extracted

**Steps:**
1. Add local notifications for:
   - clarification needed
   - job started
   - job completed
   - job failed
2. Add deep links into:
   - automation route
   - specific run detail
   - final subject result route
3. Reuse notification permission paths already present in settings/app startup.

**Verification:**
- Run: `npm.cmd run lint`
- Manual smoke on native host: notification tap opens the expected route

## Task 17: Add automation settings and diagnostics surface

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/services/settings.ts`

**Steps:**
1. Add minimal automation settings:
   - automation enabled
   - battery/network constraints if needed
   - desktop/background host hints later
2. Do not overload settings with task management UI.
3. Add read-only diagnostics where useful:
   - scheduler status
   - heartbeat last run
   - background host availability

**Verification:**
- Run: `npm.cmd run lint`

## Task 18: Add Android native scheduling support

**Files:**
- Create: `android/app/src/main/java/com/matchflow/app/AutomationSchedulerPlugin.java`
- Create: Android native scheduler/alarm receiver/service classes as needed
- Modify: `android/app/src/main/AndroidManifest.xml`
- Create: `src/services/automation/nativeScheduler.ts`

**Steps:**
1. Add a native Android scheduling bridge for exact/near-exact wakeups.
2. Register alarms for due jobs and recurring rule wakeups.
3. On wakeup, hand control to the automation execution host.
4. Reuse or coordinate with the existing foreground service for long-running execution.

**Verification:**
- Run: `npm.cmd run lint`
- Native manual smoke: schedule a near-future job and confirm it wakes and starts

## Task 19: Add Android automation background execution host

**Files:**
- Modify: existing Android foreground service classes if needed
- Create: Android bridge/runtime host classes as needed
- Create: JS bridge entrypoint under `src/services/automation/`

**Steps:**
1. Create a background-capable host that can execute automation jobs without the analysis detail UI being active.
2. Ensure wakeup -> JS runtime -> automation executor is reliable.
3. Persist progress continuously using existing resume/history-compatible patterns where appropriate.
4. Gracefully recover from process death or interrupted runs.

**Verification:**
- Native smoke:
  - app backgrounded
  - exact-time task fires
  - foreground service notification appears
  - analysis completes or writes retryable failure

## Task 20: Add desktop shell host abstraction

**Files:**
- Create: `src/services/automation/hostCapabilities.ts`
- Create: `src/services/automation/desktopHost.ts`
- Modify: shell integration files once the desktop shell repo/host layer is available

**Steps:**
1. Abstract host capability detection away from Android-only logic.
2. Define the interface desktop shell must implement:
   - persistent scheduler
   - background execution
   - notification bridge
3. Keep browser web unsupported for durable background execution.

**Verification:**
- Run: `npm.cmd run lint`

## Task 21: Add automated tests for automation core logic

**Files:**
- Create: `src/services/__tests__/automationParser.test.ts`
- Create: `src/services/__tests__/automationClarification.test.ts`
- Create: `src/services/__tests__/automationScheduler.test.ts`
- Create: `src/services/__tests__/automationHeartbeat.test.ts`
- Create: `src/services/__tests__/automationQueue.test.ts`

**Steps:**
1. Cover parser normalization.
2. Cover clarification max-round rules.
3. Cover recurring expansion and de-duplication.
4. Cover recovery window logic.
5. Cover concurrency budget behavior.

**Verification:**
- Run: `npm.cmd run test`

## Task 22: Add integration coverage for manual and automation execution convergence

**Files:**
- Create: `src/services/__tests__/automationExecutionIntegration.test.ts`
- Modify: existing analysis/history tests if shared helpers move

**Steps:**
1. Verify automation execution writes compatible history output.
2. Verify result pages can reopen automated runs through existing history paths.
3. Verify notification deep links point to stable routes.

**Verification:**
- Run: `npm.cmd run test`

## Task 23: Add docs for operators and future implementers

**Files:**
- Create: `docs/client/39-automation-heartbeat-and-scheduled-analysis-design-2026-03-11.md`
- Create: `docs/client/40-automation-heartbeat-operations-guide-2026-03-11.md`
- Modify: `docs/client/README.md`
- Modify: `docs/15-task-navigation.md`

**Steps:**
1. Document user-facing automation architecture.
2. Document Android/background execution caveats.
3. Document desktop shell expectations.
4. Add troubleshooting for missed tasks and failed wakeups.

**Verification:**
- Manual doc review

## Phase Acceptance Gates

### Phase A: UI and local planning

Pass when:

1. `/automation` route exists
2. drafts can be generated and clarified
3. drafts can be saved into local rules/jobs

### Phase B: Shared execution runtime

Pass when:

1. manual analysis still works
2. automation can launch jobs while app is active
3. results land in existing history/result views

### Phase C: Queue and heartbeat

Pass when:

1. jobs are expanded, queued, retried, and recovered locally
2. multiple jobs can run in task-level parallel mode with system-managed caps

### Phase D: Android background execution

Pass when:

1. a scheduled near-future Android job wakes on time
2. foreground service keeps long analysis alive
3. completion/failure notifications deep-link correctly

### Phase E: Desktop shell host

Pass when:

1. shell host supports persistent scheduling
2. shell host can execute jobs in background using the same automation core

## Suggested Execution Order

1. Tasks 1-5
2. Tasks 6-10
3. Tasks 11-12
4. Tasks 13-16
5. Tasks 18-19
6. Task 20
7. Tasks 21-23

## Risks to Review Before Implementation

1. The highest-risk technical step is Android wakeup to JS automation execution.
2. The highest product-risk step is poor clarification causing over-broad automation.
3. The highest runtime-risk step is uncontrolled provider burst load during full-league execution.
