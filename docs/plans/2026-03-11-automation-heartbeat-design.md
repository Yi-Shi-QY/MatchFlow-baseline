# MatchFlow Automation Heartbeat Design

Date: 2026-03-11
Status: Validated; implementation in progress with Android scheduler/host v1 landed
Scope: MatchFlow client and desktop shell automation runtime

## 0. Implementation Snapshot (2026-03-11)

Implemented in the current branch:

1. `/automation` unified command center with:
   - natural-language command composer
   - draft review
   - clarification flow
   - tasks and runs overview
2. Local-first automation storage and orchestration:
   - drafts
   - rules
   - jobs
   - runs
   - scheduler
   - heartbeat
   - queue
   - runtime coordinator
3. Shared execution runtime convergence so automation reuses the existing analysis/history pipeline.
4. Android exact-time scheduling bridge for near-exact wakeups.
5. Android automation background foreground-host v1, including wake handling and service coordination.
6. Automation notifications, settings entry points, and baseline diagnostics.

Still pending or partial:

1. richer native diagnostics surfaced in settings and troubleshooting UI
2. automation run detail and deeper failure inspection UX
3. desktop shell host abstraction and background host integration
4. operator/release documentation and production hardening from device QA

## 1. Goal

Build a local-first automation capability for MatchFlow that lets users:

1. Create one-time or recurring analysis tasks with natural language.
2. Run scheduled analyses in the background on Android native and desktop shell.
3. Receive completion/failure reminders and reopen results from notifications.
4. Launch multiple domain-specific automation tasks without turning the server into a scheduler.

This design keeps the server limited to:

1. Domain data sources.
2. Domain pack and related analysis configuration delivery.

All scheduling, clarification, execution, retry, and notification orchestration remains client-side.

## 2. Product Principles

1. Mobile-first interaction:
   - primary UX must work well on a phone
   - configuration density should be minimized
2. Local autonomy:
   - automation continues to function without a server-side job system
3. Deterministic execution:
   - natural language may help create tasks, but saved tasks must be structured
4. Cross-domain by design:
   - one command may generate multiple tasks across different domains
5. Safe ambiguity handling:
   - the system should ask targeted clarification questions before saving when intent is underspecified
6. Reuse before reinvention:
   - manual and automated analysis should converge on one execution core and one history/result pipeline

## 3. External Pattern Reference

OpenClaw separates:

1. `heartbeat`
   - periodic wakeup and inspection
   - useful for recovery scans, missed-job pickup, and retry evaluation
2. `cron`
   - precise schedule-based triggering
   - useful for exact-time execution

MatchFlow should adopt the same conceptual split:

1. a precise timer/alarm layer for scheduled wakeups
2. a heartbeat coordinator for reconciliation, retry, and missed-window compensation
3. an execution runtime that actually runs analyses

We are intentionally not copying OpenClaw's server/gateway implementation model.

## 4. User Experience

## 4.1 Entry

Add a new first-class route:

1. `/automation`

This route becomes the unified automation entry instead of hiding the feature in settings or detail pages.

It should contain three mobile-first regions:

1. Command composer
   - a single natural-language input
   - examples and recent commands
2. Draft/clarification surface
   - structured cards generated from the command
   - minimal required clarification prompts
3. Tasks and runs
   - upcoming jobs
   - enabled recurring rules
   - running jobs
   - recent results/failures

## 4.2 Creation Flow

Proposed flow:

1. User enters a natural-language command.
2. Parser returns one or more `AutomationDraft` objects.
3. Each draft is classified as:
   - `ready`
   - `needs_clarification`
   - `rejected`
4. If clarification is needed, the UI asks one minimal question at a time.
5. A maximum of three clarification rounds is allowed.
6. If still unresolved, the draft is saved as editable but inactive.
7. User reviews the final structured draft.
8. User explicitly confirms to save.
9. The draft becomes either:
   - a one-time job source
   - a recurring rule

Natural language never writes directly into active scheduling state without confirmation.

## 4.3 Mobile Interaction Rules

1. Avoid chat-thread UI as the primary surface.
2. Prefer:
   - command input
   - bottom-sheet clarification
   - compact review cards
3. Show only high-signal fields during confirmation:
   - trigger type
   - schedule
   - domain
   - target scope
   - execution volume
   - reminder policy
   - pinned domain pack/template version

## 5. Capability Model

The automation system should support three distinct but connected concepts:

1. One-time scheduled analysis
   - "Tonight at 8 analyze Real Madrid vs Barcelona"
2. Recurring rule
   - "Every day at 9 analyze all Premier League matches"
3. Coordinated heartbeat inspection
   - scan for due jobs
   - recover missed jobs
   - evaluate retryable failures

This is not one generic "heartbeat switch".

## 6. Architecture

## 6.1 Top-Level Components

1. Automation UI
2. Natural-language parser and clarification engine
3. Local rule/job/run persistence
4. Scheduler and heartbeat coordinator
5. Background-capable execution runtime
6. Notification and deep-link handling

## 6.2 Separation of Responsibilities

### Automation UI

Responsible for:

1. capturing commands
2. rendering drafts
3. collecting clarification answers
4. showing tasks and runs
5. showing execution state

Not responsible for:

1. scheduling logic
2. job persistence rules
3. execution orchestration

### Parser and Clarification Engine

Responsible for:

1. splitting a command into one or more domain-specific drafts
2. classifying ambiguity
3. asking the smallest possible next question
4. normalizing output into structured task inputs

Not responsible for:

1. directly saving active rules/jobs
2. deciding runtime concurrency

### Rule/Job/Run Store

Responsible for:

1. storing inactive drafts
2. storing confirmed recurring rules
3. storing expanded jobs
4. storing each execution attempt

### Scheduler

Responsible for:

1. mapping precise wakeups to due windows
2. deciding which jobs are eligible
3. expanding recurring rules into concrete jobs

### Heartbeat Coordinator

Responsible for:

1. periodic reconciliation
2. retry pickup
3. missed-job compensation
4. stale-running detection

### Execution Runtime

Responsible for:

1. running a concrete analysis job
2. reusing the current analysis pipeline
3. persisting results to existing history storage
4. surfacing completion/failure notifications

## 7. Data Model

## 7.1 AutomationDraft

Temporary object used during NL creation.

Suggested fields:

1. `id`
2. `sourceText`
3. `status`
   - `ready`
   - `needs_clarification`
   - `rejected`
4. `intentType`
   - `one_time`
   - `recurring`
5. `domainId`
6. `domainPackVersion`
7. `templateId`
8. `schedule`
9. `targetSelector`
10. `executionPolicy`
11. `notificationPolicy`
12. `clarificationState`
13. `createdAt`
14. `updatedAt`

## 7.2 AutomationRule

Represents a saved recurring automation definition.

Suggested fields:

1. `id`
2. `title`
3. `enabled`
4. `domainId`
5. `domainPackVersion`
6. `templateId`
7. `schedule`
8. `targetSelector`
9. `executionPolicy`
10. `notificationPolicy`
11. `timezone`
12. `lastExpandedAt`
13. `nextPlannedAt`
14. `createdAt`
15. `updatedAt`

## 7.3 AutomationJob

Represents one concrete execution candidate.

Suggested fields:

1. `id`
2. `sourceRuleId`
3. `triggerType`
   - `one_time`
   - `schedule`
   - `retry`
   - `recovery`
4. `domainId`
5. `domainPackVersion`
6. `templateId`
7. `scheduledFor`
8. `targetSnapshot`
9. `targetSelectorSnapshot`
10. `state`
    - `pending`
    - `eligible`
    - `running`
    - `completed`
    - `failed_retryable`
    - `failed_terminal`
    - `cancelled`
    - `expired`
11. `retryCount`
12. `maxRetries`
13. `retryAfter`
14. `recoveryWindowEndsAt`
15. `priority`
16. `createdAt`
17. `updatedAt`

## 7.4 AutomationRun

Represents one actual execution attempt.

Suggested fields:

1. `id`
2. `jobId`
3. `state`
4. `startedAt`
5. `endedAt`
6. `provider`
7. `model`
8. `inputTokens`
9. `outputTokens`
10. `totalTokens`
11. `tokenSource`
12. `resultHistoryId`
13. `errorCode`
14. `errorMessage`
15. `runtimeSnapshot`

## 8. Target Resolution

The server remains a data/config provider only.

Target resolution happens client-side through local orchestration plus existing APIs.

Supported target selector modes:

1. `fixed_subject`
   - a concrete match or domain entity
2. `league_query`
   - for league-wide recurring jobs
3. `server_resolve`
   - client fetches current candidates and expands locally

The existing client already uses:

1. `/matches`
2. `/analysis/config/*`
3. domain registry and pack metadata

These are sufficient for first-phase target expansion.

## 9. Clarification Strategy

Ambiguous commands should not be guessed into active jobs.

Rules:

1. Ask only one clarification question at a time.
2. Ask only for the smallest missing decision.
3. Limit clarification rounds to three.
4. If still unresolved:
   - save a draft
   - mark it inactive
   - let user edit manually

Examples of clarification triggers:

1. target entity ambiguous
2. time ambiguous
3. recurring vs one-time unclear
4. multiple possible domains for the same phrase

## 10. Scheduling Strategy

## 10.1 Exact-Time Triggering

Use platform-specific wakeup support for exact or near-exact triggers.

Android:

1. alarm/scheduler triggers wakeup
2. foreground service is started for long analysis execution

Desktop shell:

1. main/background process timer
2. tray or background host launches local execution

## 10.2 Heartbeat Reconciliation

Heartbeat is responsible for:

1. scanning due jobs
2. detecting missed scheduled windows
3. requeueing retryable failures
4. detecting stale running jobs

It should run on a conservative interval and not itself contain domain-specific analysis logic.

## 10.3 Recovery Rules

First-phase defaults:

1. one-time jobs:
   - recover within 30 minutes
2. recurring daily jobs:
   - recover within the current schedule window
   - do not cross day boundary by default

## 11. Execution Strategy

## 11.1 Reuse Existing Analysis Pipeline

Current manual analysis already supports:

1. runtime status tracking
2. resume state persistence
3. history persistence
4. notification updates
5. Android foreground service status updates

The automation system should reuse these behaviors through a non-UI execution service.

## 11.2 Parallelism Model

Phase-one parallelism must be:

1. task-level parallelism only
2. not segment-level parallelism inside a single analysis

Reason:

1. the current single-analysis pipeline is intentionally sequential
2. segment dependencies and summary generation rely on ordered context
3. changing this would add unnecessary quality and resume complexity

## 11.3 Concurrency Budget

Concurrency is system-managed, not user-configured in phase one.

Suggested defaults:

Android:

1. background safe mode: 2
2. favorable conditions: 3

Desktop shell:

1. baseline: 4
2. favorable conditions: 6

Budget should also consider:

1. provider/model-level caps
2. battery/power state
3. network condition
4. app host type

## 12. Notifications

Notifications should support:

1. job started
2. running summary
3. completed
4. failed
5. clarification needed

Deep links should point to:

1. automation run detail
2. final analysis result
3. pending draft clarification

## 13. Platform Strategy

## 13.1 Android

Must support background continuous execution.

Requires:

1. precise wakeup integration
2. background-capable JS execution host or bridge
3. foreground service continuation for long tasks

The current foreground-service implementation is necessary but not sufficient on its own.

## 13.2 Desktop Shell

Web in a desktop shell can participate if it has a real background process/main process host.

Pure browser tab background execution should not be treated as reliable continuous execution.

## 13.3 Browser Web

Can support:

1. automation UI
2. task management
3. history viewing

But should not promise durable background long-running execution.

## 14. Risks

1. Android wakeup-to-JS-runtime bridging is the highest technical risk.
2. Allowing full-league automation can generate heavy API/provider load.
3. Natural-language ambiguity can create accidental over-broad jobs if confirmation is weak.
4. Cross-domain task creation increases the need for pinned pack/template compatibility.
5. If execution logic remains too coupled to React context, background orchestration will be fragile.

## 15. Phase Plan Summary

### Phase 1

1. Automation route and mobile-first UI
2. NL drafts and clarification loop
3. local storage tables
4. manual launch from automation page

### Phase 2

1. non-UI execution runtime
2. queue and concurrency budget
3. automation run records
4. result/deep-link integration

### Phase 3

1. Android exact-time wakeup
2. Android background execution host
3. heartbeat reconciliation
4. retry and recovery window support

### Phase 4

1. desktop shell host integration
2. tray/background scheduler support

### Phase 5

1. operational polish
2. richer task/rule management
3. observability and diagnostics

## 16. Acceptance Intent

This feature should be considered successful when:

1. a user can create automation tasks from natural language on a phone
2. ambiguous commands are clarified before activation
3. Android can schedule and continuously execute analyses in background
4. desktop shell can run the same model with a local host
5. automated runs reuse the same analysis result/history infrastructure as manual runs
6. multiple domain automation tasks can coexist without a server-side job system
