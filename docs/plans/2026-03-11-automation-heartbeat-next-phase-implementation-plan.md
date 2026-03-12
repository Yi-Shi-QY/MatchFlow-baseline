# MatchFlow Automation Heartbeat Next Phase Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the new automation/heartbeat system with native diagnostics, run-level troubleshooting, deeper integration coverage, desktop-host abstraction, and operator-ready documentation.

**Architecture:** Keep the current local-first automation runtime intact, then add observability and host abstraction around it instead of reopening the core scheduler/queue design. The next phase should make Android failures debuggable, keep manual and automation paths provably aligned, and prepare the same runtime to be hosted by a future desktop shell.

**Tech Stack:** React 19, Vite, TypeScript, Capacitor, Android native plugins/services, Vitest, existing MatchFlow automation runtime and history pipeline.

---

## Implementation Notes

1. Start with visibility before more platform reach.
2. Do not add desktop-specific execution logic until host capability boundaries are explicit.
3. Prefer extending the current runtime snapshots and stores over inventing a second diagnostics path.
4. Keep browser web in management-only mode for durable background expectations.

### Task 1: Persist native wake telemetry end-to-end

**Files:**
- Modify: `android/app/src/main/java/com/matchflow/app/AutomationSchedulerStore.java`
- Modify: `android/app/src/main/java/com/matchflow/app/AutomationAlarmReceiver.java`
- Modify: `android/app/src/main/java/com/matchflow/app/AutomationSchedulerPlugin.java`
- Modify: `src/services/automation/nativeScheduler.ts`
- Modify: `src/services/automation/types.ts`
- Test: `src/services/__tests__/automationNativeScheduler.test.ts`

**Steps:**
1. Write a failing test in `src/services/__tests__/automationNativeScheduler.test.ts` that expects a normalized telemetry payload for last scheduled wake, last received alarm, last handoff attempt, and last native error.
2. Run `npm.cmd run test` and confirm the new telemetry assertions fail for the expected missing fields.
3. Extend `android/app/src/main/java/com/matchflow/app/AutomationSchedulerStore.java` to persist telemetry snapshots and update `android/app/src/main/java/com/matchflow/app/AutomationAlarmReceiver.java` plus `android/app/src/main/java/com/matchflow/app/AutomationSchedulerPlugin.java` so the bridge can read and reset them.
4. Update `src/services/automation/nativeScheduler.ts` and `src/services/automation/types.ts` so TypeScript callers can fetch typed native telemetry without Android-specific parsing in the UI layer.
5. Run `npm.cmd run test`, then `npm.cmd run lint`, and confirm the telemetry test passes without TypeScript regressions.
6. Commit with `git add android/app/src/main/java/com/matchflow/app/AutomationSchedulerStore.java android/app/src/main/java/com/matchflow/app/AutomationAlarmReceiver.java android/app/src/main/java/com/matchflow/app/AutomationSchedulerPlugin.java src/services/automation/nativeScheduler.ts src/services/automation/types.ts src/services/__tests__/automationNativeScheduler.test.ts` and `git commit -m "feat: persist automation native wake telemetry"`.

### Task 2: Surface automation diagnostics in Settings and `/automation`

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/automation/AutomationDiagnosticsCard.tsx`
- Modify: `src/pages/automation/useAutomationPageState.ts`
- Modify: `src/services/automation/runtimeCoordinator.ts`
- Modify: `src/services/automation/nativeScheduler.ts`
- Modify: `src/services/settings.ts`
- Test: `src/services/__tests__/automationRuntimeCoordinator.test.ts`

**Steps:**
1. Write a failing test in `src/services/__tests__/automationRuntimeCoordinator.test.ts` that expects the runtime snapshot to include native telemetry, host availability, last heartbeat timing, and pending work counts.
2. Run `npm.cmd run test` and confirm the snapshot shape fails until the new diagnostics fields are wired through.
3. Extend `src/services/automation/runtimeCoordinator.ts` and `src/services/automation/nativeScheduler.ts` to publish a richer diagnostics snapshot, then render the high-signal fields in `src/pages/Settings.tsx` and `src/pages/automation/AutomationDiagnosticsCard.tsx` without turning either surface into a debug dump.
4. Add safe operator actions where already supported, such as refresh diagnostics, sync native schedule, and kick the runtime, while keeping toggle state in `src/services/settings.ts` minimal and mobile-friendly.
5. Run `npm.cmd run test`, `npm.cmd run lint`, and `npm.cmd run build`, then do a manual Android smoke check to confirm the diagnostics reflect a real wake cycle.
6. Commit with `git add src/pages/Settings.tsx src/pages/automation/AutomationDiagnosticsCard.tsx src/pages/automation/useAutomationPageState.ts src/services/automation/runtimeCoordinator.ts src/services/automation/nativeScheduler.ts src/services/settings.ts src/services/__tests__/automationRuntimeCoordinator.test.ts` and `git commit -m "feat: surface automation diagnostics"`.

### Task 3: Add automation run detail and troubleshooting UI

**Files:**
- Create: `src/pages/automation/AutomationRunDetail.tsx`
- Create: `src/pages/automation/useAutomationRunDetailState.ts`
- Modify: `src/App.tsx`
- Modify: `src/pages/automation/AutomationRunList.tsx`
- Modify: `src/services/automation/runStore.ts`
- Modify: `src/services/automation/executor.ts`
- Modify: `src/services/automation/notifications.ts`
- Test: `src/services/__tests__/automationExecutionIntegration.test.ts`

**Steps:**
1. Write a failing integration test in `src/services/__tests__/automationExecutionIntegration.test.ts` that expects an automation run to persist troubleshooting metadata and reopen through a stable run-detail route.
2. Run `npm.cmd run test` and confirm the new route and persisted metadata are missing.
3. Extend `src/services/automation/executor.ts` and `src/services/automation/runStore.ts` to save troubleshooting payloads such as wake source, retry reason, provider/model summary, timing, and error metadata, then add a dedicated route in `src/App.tsx` with mobile-first rendering in `src/pages/automation/AutomationRunDetail.tsx`.
4. Update `src/pages/automation/AutomationRunList.tsx` and `src/services/automation/notifications.ts` so list taps and notification deep links land on the run-detail screen first, with links onward to the final analysis result when available.
5. Run `npm.cmd run test`, `npm.cmd run lint`, and `npm.cmd run build`, then manually verify a failed and a completed automation run on a device.
6. Commit with `git add src/pages/automation/AutomationRunDetail.tsx src/pages/automation/useAutomationRunDetailState.ts src/App.tsx src/pages/automation/AutomationRunList.tsx src/services/automation/runStore.ts src/services/automation/executor.ts src/services/automation/notifications.ts src/services/__tests__/automationExecutionIntegration.test.ts` and `git commit -m "feat: add automation run troubleshooting view"`.

### Task 4: Deepen manual and automation convergence coverage

**Files:**
- Modify: `src/services/__tests__/automationExecutionIntegration.test.ts`
- Modify: `src/services/__tests__/automationNotifications.test.ts`
- Modify: `src/services/__tests__/automationExecutor.test.ts`
- Modify: `src/services/history.ts`
- Modify: `src/App.tsx`

**Steps:**
1. Add failing tests that cover three paths: automation result writes compatible history output, notification deep links reopen stable routes, and retry/resume flows do not duplicate history entries.
2. Run `npm.cmd run test` and record the first failing path rather than fixing all three blindly.
3. Apply the minimum production fixes in `src/services/history.ts`, `src/App.tsx`, and any automation runtime helpers needed to keep manual and automated reopen behavior aligned.
4. Re-run `npm.cmd run test` until the new convergence coverage passes, then run `npm.cmd run lint` to catch type drift introduced by the test-led fixes.
5. Commit with `git add src/services/__tests__/automationExecutionIntegration.test.ts src/services/__tests__/automationNotifications.test.ts src/services/__tests__/automationExecutor.test.ts src/services/history.ts src/App.tsx` and `git commit -m "test: harden automation and manual convergence"`.

### Task 5: Introduce host capability abstraction for desktop-shell preparation

**Files:**
- Create: `src/services/automation/hostCapabilities.ts`
- Create: `src/services/automation/desktopHost.ts`
- Modify: `src/services/automation/runtimeCoordinator.ts`
- Modify: `src/services/automation/nativeScheduler.ts`
- Modify: `src/services/automation/index.ts`
- Test: `src/services/__tests__/automationHostCapabilities.test.ts`

**Steps:**
1. Write a failing test in `src/services/__tests__/automationHostCapabilities.test.ts` that expects host detection to distinguish Android native, browser web, and desktop-shell-capable environments through one capability contract.
2. Run `npm.cmd run test` and confirm host capability resolution is currently too Android-specific.
3. Create `src/services/automation/hostCapabilities.ts` and `src/services/automation/desktopHost.ts`, then move platform branching behind the new interface so `src/services/automation/runtimeCoordinator.ts` asks for capabilities instead of hard-coding Android assumptions.
4. Keep browser web explicitly management-only for durable background execution, and leave desktop host methods as a well-typed stub contract until the shell host is available.
5. Run `npm.cmd run test`, `npm.cmd run lint`, and `npm.cmd run build` to confirm the abstraction does not break the current Android path.
6. Commit with `git add src/services/automation/hostCapabilities.ts src/services/automation/desktopHost.ts src/services/automation/runtimeCoordinator.ts src/services/automation/nativeScheduler.ts src/services/automation/index.ts src/services/__tests__/automationHostCapabilities.test.ts` and `git commit -m "refactor: add automation host capability abstraction"`.

### Task 6: Write operator docs and rollout checklist

**Files:**
- Create: `docs/client/39-automation-heartbeat-and-scheduled-analysis-design-2026-03-11.md`
- Create: `docs/client/40-automation-heartbeat-operations-guide-2026-03-11.md`
- Modify: `docs/client/README.md`
- Modify: `docs/15-task-navigation.md`

**Steps:**
1. Draft an outline that separates architecture, Android operational caveats, troubleshooting flows, and release checklist responsibilities so future editors do not mix them into one long note.
2. Review the current implementation files and tests to confirm the docs describe only what actually exists today, especially around Android wake guarantees and browser-web limitations.
3. Write the design document and operations guide, then update `docs/client/README.md` and `docs/15-task-navigation.md` so the new automation docs are discoverable from both client and task-based entry points.
4. Manually review the docs for accuracy against the current runtime behavior, including exact-alarm limitations, foreground notification expectations, and device-QA checkpoints.
5. Commit with `git add docs/client/39-automation-heartbeat-and-scheduled-analysis-design-2026-03-11.md docs/client/40-automation-heartbeat-operations-guide-2026-03-11.md docs/client/README.md docs/15-task-navigation.md` and `git commit -m "docs: add automation heartbeat operator guidance"`.

## Phase Acceptance Gates

### Phase A: Diagnostics and observability

Pass when:

1. the UI exposes last native wake and last heartbeat information
2. operators can tell whether Android scheduling and host bootstrapping actually happened

### Phase B: Troubleshooting depth

Pass when:

1. a completed or failed automation run has a stable detail route
2. the route shows enough metadata to debug wake, retry, and provider issues

### Phase C: Runtime correctness confidence

Pass when:

1. integration tests prove automation and manual reopen paths converge on the same history/result model
2. retry/resume flows do not create duplicate or orphaned history entries

### Phase D: Host portability readiness

Pass when:

1. Android-specific behavior is isolated behind a host capability contract
2. desktop shell requirements are explicit without promising browser-web durability

### Phase E: Operator readiness

Pass when:

1. client docs explain architecture, operational caveats, and troubleshooting
2. a release checklist exists before wider rollout

## Suggested Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6

## Risks to Review Before Execution

1. Native telemetry can turn noisy if every wake detail is persisted without a clear schema.
2. Run-detail UI can become unreadable on phones unless only high-signal troubleshooting fields are shown by default.
3. Host abstraction can become premature indirection if it leaks desktop assumptions before the shell host exists.
4. Documentation can easily overstate reliability guarantees if it is not checked against real-device testing results.
