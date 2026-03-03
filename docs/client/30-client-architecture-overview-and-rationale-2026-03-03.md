# Client Architecture Overview and Rationale (2026-03-03)

## 1. Purpose

This document is the complete explanation of the current client architecture after the 2026-03-03 refactor wave.

It answers:

1. What the target architecture is.
2. What was changed in this round.
3. Why these changes were made.
4. How this differs from the old structure.
5. What baseline quality is required before release.

Scope of this document is `MatchFlow/src` only. No server implementation changes are included.

## 2. Design Goals

The client has moved from a football-first implementation toward a general analysis platform with domain modules.

Primary goals:

1. Make adding a new analysis domain predictable and safe.
2. Keep domain behavior isolated (data sources, planning, agents, templates, local cases).
3. Keep compatibility for existing imports and existing data flows.
4. Enforce minimum local validation quality for every built-in domain.
5. Decouple summary UI from football-only result shape.

Non-goals in this round:

1. No breaking replacement of `Match` entity yet.
2. No server-side schema or endpoint rewrite.
3. No forced migration of existing extensions.

## 3. Architecture Layers

The runtime architecture is now layered as follows.

### 3.1 Domain Runtime Layer

Defines each analysis domain and its data-source behavior.

- Core type: `AnalysisDomain`
- Source files:
  - `src/services/domains/modules/football/domain.ts`
  - `src/services/domains/modules/basketball/domain.ts`
  - `src/services/domains/types.ts`

Responsibilities:

1. Domain metadata (`id`, `name`, `resources`).
2. Available data sources and default selection policy.
3. Domain-specific `buildSourceCapabilities` signals for planning.

### 3.2 Domain Planning Layer

Defines how each domain routes to plan mode and template under different source signals.

- Source files:
  - `src/services/domains/modules/football/planning.ts`
  - `src/services/domains/modules/basketball/planning.ts`
  - `src/services/domains/planning/registry.ts`
  - `src/services/ai/planning.ts`

Responsibilities:

1. Resolve route (`template` vs `autonomous`).
2. Pick template IDs by domain signals.
3. Guarantee required terminal agent segment.
4. Provide domain fallback plan.

### 3.3 Built-in Module Registry Layer

Central assembly and validation of built-in domains.

- Source files:
  - `src/services/domains/builtinModules.ts`
  - `src/services/domains/modules/types.ts`
  - `src/services/domains/modules/football/module.ts`
  - `src/services/domains/modules/basketball/module.ts`

Responsibilities:

1. Build built-in module list.
2. Validate module integrity.
3. Enforce local case minimum.
4. Provide domain and planning lists to registries.
5. Provide local test-case queries for fallback/recovery.

### 3.4 Agent Layer

Domain agents are now folder-scoped.

- Source files:
  - `src/agents/domains/football/*`
  - `src/agents/domains/basketball/*`
  - `src/agents/index.ts`

Responsibilities:

1. Domain-specific analysis roles.
2. Shared cross-domain agents (planner, summary, tag, animation).
3. Built-in + extension agent resolution.

### 3.5 Planner Template Layer

Template catalog split by domain folders.

- Source files:
  - `src/skills/planner/templates/football/*`
  - `src/skills/planner/templates/basketball/*`
  - `src/skills/planner/index.ts`

Responsibilities:

1. Domain template registration.
2. Segment structure and agent assignment.
3. Template requirement extraction for runtime auto-install checks.

### 3.6 Animation Template Layer

Animation template definitions and type mapping.

- Source files:
  - `src/services/remotion/templates.tsx`
  - `src/services/remotion/templateParams.ts`

Responsibilities:

1. Define template schemas and fill logic.
2. Map planning `animationType` to render template.
3. Validate payload before rendering.

### 3.7 UI, Persistence, and Recovery Layer

User domain selection, data assembly, analysis execution, and history/resume continuity.

- Source files:
  - `src/pages/Settings.tsx`
  - `src/pages/Home.tsx`
  - `src/pages/MatchDetail.tsx`
  - `src/contexts/AnalysisContext.tsx`
  - `src/services/history.ts`
  - `src/services/savedMatches.ts`
  - `src/services/analysisSummary.ts`

Responsibilities:

1. Persist active domain setting.
2. Build `sourceContext` before analysis.
3. Stream analysis and persist resume snapshots.
4. Load match from multiple fallback sources to reduce "Match not found".
5. Render generic summary distributions/cards across domains.

## 4. Current File Structure (Refactored)

```text
src/
  agents/
    domains/
      football/
      basketball/
    index.ts
    planner_template.ts
    planner_autonomous.ts
    summary.ts
    tag.ts
    animation.ts
  skills/
    planner/
      templates/
        football/
        basketball/
      index.ts
  services/
    ai/
      planning.ts
    domains/
      modules/
        football/
          domain.ts
          planning.ts
          localCases.ts
          module.ts
          index.ts
        basketball/
          domain.ts
          planning.ts
          localCases.ts
          module.ts
          index.ts
        shared/
          cloneMatch.ts
        types.ts
        index.ts
      builtinModules.ts
      registry.ts
      planning/
        registry.ts
        football.ts        (compat shim)
        basketball.ts      (compat shim)
      football.ts          (compat shim)
      basketball.ts        (compat shim)
    remotion/
      templates.tsx
      templateParams.ts
    analysisSummary.ts
```

## 5. End-to-End Runtime Flow

### 5.1 Domain Selection to Data Assembly

1. User selects domain in settings (`activeDomainId`).
2. `getActiveAnalysisDomain()` resolves runtime domain.
3. `MatchDetail` applies selected domain data sources.
4. `sourceContext` is written into analysis payload, including:
   - `domainId`
   - `selectedSources`/`selectedSourceIds`
   - `capabilities`
   - `matchStatus`

### 5.2 Planning Resolution

1. `resolvePlanningRoute()` first checks explicit overrides (`sourceContext.planning` and settings).
2. If no override, it loads domain planning strategy by `domainId`.
3. Strategy returns route decision (template/autonomous + constraints).
4. Plan is normalized (`normalizePlan()`), with required terminal agent enforced.

### 5.3 Agent Streaming and Animation

1. Segment-by-segment agent execution runs from generated plan.
2. Each segment may trigger animation pipeline if `animationType` is enabled.
3. Tag generation runs after segment analysis.
4. Final summary agent emits structured summary payload.

### 5.4 Summary Rendering and Persistence

1. `analysisSummary.ts` converts summary payload to UI-friendly:
   - distribution bars
   - conclusion cards
2. Preference order:
   - `outcomeDistribution` first
   - fallback to legacy `winProbability`
3. History and resume state are persisted with match snapshot for better recovery.

## 6. Quality Guards Introduced

Central guards in `builtinModules.ts`:

1. Each built-in domain must have unique `domain.id`.
2. `planningStrategy.domainId` must exist and match `domain.id`.
3. Data-source IDs inside one domain should not duplicate (warning).
4. Each built-in domain must provide at least 3 local test cases.
5. Local case IDs must be non-empty and unique.

This is currently the strongest guarantee that a newly added local domain is testable before release.

## 7. Compatibility Strategy

To avoid breaking existing imports during refactor:

1. Kept shim exports:
   - `src/services/domains/football.ts`
   - `src/services/domains/basketball.ts`
   - `src/services/domains/planning/football.ts`
   - `src/services/domains/planning/basketball.ts`
2. Old callers still resolve, while new code uses module folders.
3. Summary layer keeps legacy `winProbability` compatibility.

## 8. Before vs After

| Topic | Before | After |
|---|---|---|
| Domain service layout | Flat files | Module folders per domain |
| Agent organization | Mostly flat | `agents/domains/<domain>/` |
| Planner templates | Mixed in one folder | `templates/football` and `templates/basketball` |
| Built-in domain assembly | Scattered references | Central module registry + validation |
| Local case policy | No strict minimum gate | Hard minimum: 3 cases per built-in domain |
| Final summary model | Football-centric | Generic distribution/cards with legacy fallback |
| Recovery path | Weaker fallback chain | Multi-source match lookup + resume snapshot |

## 9. Release Baseline for "Domain-Ready"

A new domain should not be considered release-ready unless all are true:

1. Domain module exists and is registered in built-in modules.
2. Planning strategy exists and routes correctly for source combinations.
3. Domain agents and templates are registered and callable.
4. Domain animation mapping exists for used `animationType` values.
5. Local test cases count is at least 3 and IDs are unique.
6. Home fallback and MatchDetail fallback can load domain test cases.
7. Summary UI displays meaningful result using generic summary fields.
8. `npm run lint` and `npm run build` both pass.
9. Manual smoke scenarios pass (domain switch, analysis run, return from history, resume flow).

## 10. Related Documents

Read with:

1. `docs/client/27-client-file-structure-refactor-2026-03-03.md`
2. `docs/client/28-service-domain-modules-refactor-2026-03-03.md`
3. `docs/client/29-builtin-module-split-refactor-2026-03-03.md`
4. `docs/client/26-client-optimization-and-server-alignment-2026-03-03.md`

