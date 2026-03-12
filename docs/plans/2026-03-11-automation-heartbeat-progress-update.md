# MatchFlow Automation Heartbeat Progress Update

Date: 2026-03-11
Status: Active implementation update
Owner: Current `main` worktree

## 1. Branch and Worktree Snapshot

1. Current branch: `main`
2. Tracking branch: `origin/main`
3. Local commit for this round: none yet
4. Worktree state: dirty
5. Important note:
   - this worktree contains both the current automation/heartbeat changes and unrelated in-progress changes
   - do not assume every modified file in `git status` belongs only to this feature

Current high-signal modified areas:

1. `src/services/automation/*`
2. `src/pages/Automation.tsx`
3. `src/pages/automation/*`
4. `src/pages/Settings.tsx`
5. `src/services/settings.ts`
6. `src/contexts/AnalysisContext.tsx`
7. `src/services/background/androidForegroundExecution.ts`
8. `android/app/src/main/java/com/matchflow/app/*`
9. `android/app/src/main/AndroidManifest.xml`

## 2. What Landed in This Round

## 2.1 Unified Natural-Language Entry

The client now has a first-class `/automation` surface for:

1. natural-language command entry
2. immediate analysis launch
3. automation draft generation
4. clarification before activation
5. task/run overview

This is now the unified user entry instead of scattering automation through settings or detail-only actions.

## 2.2 Local-First Automation Runtime

The automation runtime is now client-orchestrated and server-light:

1. drafts, rules, jobs, and runs persist locally
2. scheduler expands recurring rules into jobs
3. heartbeat reconciles due work, retries, and stale states
4. queue enforces task-level parallelism
5. runtime coordinator keeps orchestration in one place

The server still only needs to provide:

1. analysis data sources
2. domain packages/configuration

## 2.3 Manual and Automation Execution Convergence

Automation now reuses the same analysis pipeline foundations as manual analysis:

1. shared execution runtime
2. resume-compatible state persistence
3. existing history/result pipeline
4. local notifications and deep links

This reduces the risk of manual and automated results diverging structurally.

## 2.4 Android Background Execution v1

Android background support was hardened in this round:

1. exact-alarm scheduler bridge landed
2. alarm receiver can wake the automation path
3. automation foreground execution host was added
4. foreground execution now uses scopes so `analysis` and `automation` do not stop each other
5. wake handling more aggressively starts the automation slot to reduce post-wake delays

Behavior defaults were also tightened for reliability:

1. automation execution defaults to `resumeMode: enabled`
2. retry executions resume by default
3. background execution disables animations by default

## 3. Validation Snapshot

Validated in this environment:

1. `npm.cmd run lint`
2. `npm.cmd run build`
3. `npm.cmd run test`

Current automated result:

1. 17 test files passed
2. 43 tests passed

Native validation note:

1. Android Studio is the reliable build truth right now
2. CLI Gradle wrapper in this environment is not trustworthy because `android/gradle/wrapper/gradle-wrapper.jar` is corrupt here

## 4. Known Gaps After This Round

1. Native wake/foreground telemetry is not yet surfaced cleanly in the UI.
2. Automation run detail and troubleshooting depth are still too thin for field debugging.
3. Desktop shell host abstraction is still pending.
4. Home entry copy/polish can still be improved.
5. Browser web should continue to expose management UI only and must not claim durable background execution.

## 5. Recommended QA Focus During Android Testing

1. Create a near-future one-time automation job, background the app, and verify exact-time wake behavior.
2. Confirm the foreground notification appears quickly after wake and remains until execution settles.
3. Force an interruption during execution and confirm resume/retry behavior is sensible on the next wake.
4. Queue multiple eligible jobs and confirm task-level parallelism is bounded rather than flooding the device.
5. Tap completion/failure notifications and verify deep links reopen the correct automation or result context.
6. Observe whether some wake events feel delayed after device idle or OEM battery restrictions.

## 6. Suggested Focus for the Next Phase

1. Persist and display native wake telemetry.
2. Add run-level troubleshooting UI.
3. Add deeper integration coverage across manual and automation reopen paths.
4. Introduce desktop host capability abstraction.
5. Write operator docs and a release checklist before broader rollout.
