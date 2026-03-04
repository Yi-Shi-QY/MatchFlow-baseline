# Client Maintenance and Extension Guide (2026-03-03)

## 1. Guide Objective

This guide describes the required process to safely maintain and extend the client as a general analysis platform.

It is optimized for one high-frequency task:

- Add a new independent analysis domain with reliable local testability and release readiness.

This guide assumes server code remains unchanged in this phase.

## 2. Ground Rules

Before adding a domain, follow these rules:

1. Domain code must be domain-scoped, not mixed into another domain folder.
2. Every local built-in domain must ship at least 3 local test cases.
3. New template IDs, agent IDs, and data-source IDs must be unique.
4. Domain templates and domain agents must be aligned (no cross-domain accidental reuse unless intentional).
5. Keep compatibility for existing imports unless a coordinated breaking migration is planned.
6. Do not modify server behavior as part of this client extension flow.

## 3. Quick Checklist (One-Screen Version)

For a new domain `<domainId>`, all of the following should exist:

1. `src/services/domains/modules/<domainId>/domain.ts`
2. `src/services/domains/modules/<domainId>/planning.ts`
3. `src/services/domains/modules/<domainId>/localCases.ts` with at least 3 case items
4. `src/services/domains/modules/<domainId>/module.ts`
5. `src/services/domains/modules/<domainId>/index.ts`
6. `module.ts` exports `DOMAIN_MODULE_FACTORIES`
7. `src/services/domains/builtinModules.ts` auto-discovery remains valid
8. Domain agents under `src/agents/domains/<domainId>/`
9. `src/agents/domains/<domainId>/index.ts` exports `DOMAIN_AGENT_ENTRIES` and `DOMAIN_AGENT_VERSION_ENTRIES`
10. Planner templates under `src/skills/planner/templates/<domainId>/`
11. `src/skills/planner/templates/<domainId>/index.ts` exports `DOMAIN_TEMPLATE_ENTRIES`
12. Domain UI presenter under `src/services/domains/ui/presenters/<domainId>.ts` exporting `DOMAIN_UI_PRESENTER_ENTRIES`
13. Animation template and type mapping if templates use non-`none` animations
14. Home/MatchDetail smoke flow works with local cases and history/resume
15. `npm run lint` and `npm run build` pass

## 4. Step-by-Step Extension Procedure

## 4.1 Create Domain Module Skeleton

Add folder:

- `src/services/domains/modules/<domainId>/`

Required files:

1. `domain.ts`
2. `planning.ts`
3. `localCases.ts`
4. `module.ts`
5. `index.ts`

Recommended `module.ts` pattern:

```ts
import type { BuiltinDomainModule } from "../types";
import { <domainId>Domain } from "./domain";
import { <domainId>PlanningStrategy } from "./planning";
import { build<DomainName>LocalCases } from "./localCases";

export function create<DomainName>BuiltinModule(caseMinimum: number): BuiltinDomainModule {
  return {
    domain: <domainId>Domain,
    planningStrategy: <domainId>PlanningStrategy,
    localTestCases: build<DomainName>LocalCases(caseMinimum),
  };
}
```

## 4.2 Implement Domain Data Sources (`domain.ts`)

In `domain.ts`, define:

1. Domain metadata (`id`, `name`, `description`).
2. Domain resources (`templates`, `animations`, `agents`, `skills`).
3. `dataSources`, `getAvailableDataSources`, `resolveSourceSelection`, and `buildSourceCapabilities`.

Important:

1. Data-source IDs should reflect domain semantics.
2. `buildSourceCapabilities` should expose signals needed by planning strategy.
3. Keep legacy alias handling only if migration compatibility is needed.

## 4.3 Implement Planning Strategy (`planning.ts`)

In `planning.ts`, implement `DomainPlanningStrategy`:

1. `resolveRoute` based on domain source signals.
2. `buildFallbackPlan` when parsing/planning fails.
3. `requiredTerminalAgentType` to ensure final conclusion segment.

Design rules:

1. Route should be deterministic for the same input.
2. Fallback plan must be executable with guaranteed available agents.
3. If strategy uses template IDs, ensure those template IDs are discoverable via `DOMAIN_TEMPLATE_ENTRIES`.

## 4.4 Add Local Test Cases (`localCases.ts`)

Local case minimum is hard-gated by `builtinModules.ts`.

Requirements:

1. At least 3 test cases.
2. Every case has a non-empty unique `id`.
3. Cases should cover multiple statuses (recommended):
   - upcoming
   - live
   - finished
4. Cases should exercise different source capabilities.

Recommended coverage matrix:

1. One case with market-heavy data.
2. One case with stats/performance-heavy data.
3. One case with minimal data plus custom/situational notes.

## 4.5 Module Auto-discovery Contract

Ensure:

1. `src/services/domains/modules/<domainId>/module.ts` exports:
   - `create<DomainName>BuiltinModule(...)`
   - `DOMAIN_MODULE_FACTORIES`
2. `src/services/domains/builtinModules.ts` keeps auto-discovery contract:
   - `import.meta.glob("./modules/*/module.ts")`

Do not bypass the central validator.

## 4.6 Add Domain Agents

Create folder:

- `src/agents/domains/<domainId>/`

Recommended set:

1. overview agent
2. stats/metrics agent
3. tactical/structure agent
4. market/contextual signal agent (if applicable)
5. prediction agent
6. general fallback agent

Then:

1. Export them in `src/agents/domains/<domainId>/index.ts`.
2. Export `DOMAIN_AGENT_ENTRIES` and `DOMAIN_AGENT_VERSION_ENTRIES` in that index file.
3. `src/agents/index.ts` auto-discovers `src/agents/domains/*/index.ts`.

Rules:

1. Agent ID naming should be domain-prefixed if cross-domain conflict is possible.
2. Prompt logic should use domain terms, not football-only wording.

## 4.7 Add Domain Planner Templates

Create folder:

- `src/skills/planner/templates/<domainId>/`

Add templates (example):

1. `<domain>_basic`
2. `<domain>_standard`
3. `<domain>_<focus>_focused`
4. `<domain>_comprehensive`

Then:

1. Export from `src/skills/planner/templates/<domainId>/index.ts`.
2. Export `DOMAIN_TEMPLATE_ENTRIES` from that index file.
3. `src/skills/planner/index.ts` auto-discovers `src/skills/planner/templates/*/index.ts`.

Template quality rules:

1. `requiredAgents` must match real agent IDs.
2. Segment `agentType` values must exist in agent registry.
3. Segment `animationType` values must map to known animation templates.
4. Final segment should align with strategy terminal agent expectation.

## 4.8 Add or Map Animation Templates (If Needed)

If domain templates use custom `animationType` values:

1. Add template component in `src/services/remotion/templates.tsx`.
2. Add type-to-template mapping in `src/services/remotion/templateParams.ts`.
3. Add validation rules for required params.

If no new animation is needed:

1. Reuse existing animation types and keep mapping consistent.

## 4.9 Verify Summary Compatibility for Non-Versus Domains

Current summary model supports general shape:

1. `outcomeDistribution[]`
2. `conclusionCards[]`

Legacy football-style fields (`winProbability`) are fallback only.

For new domains:

1. Make summary agent output generic fields first.
2. Ensure UI (`analysisSummary.ts`, home card, detail page) can render meaningful values without `home/draw/away` assumptions.

## 4.10 Verify UI and Runtime Integration

Minimum runtime checks:

1. Settings can switch to new domain and save it.
2. Home fallback data uses new domain local cases when server list is unavailable.
3. MatchDetail source controls reflect new domain data sources.
4. Analysis run completes with your domain agents and templates.
5. History card click can reopen detail without "Match not found".
6. Resume flow works after leaving and returning during analysis.

## 5. Maintenance Playbook (Existing Domains)

When editing an existing domain:

1. Prefer changes in its own module folder.
2. Keep shared contract files stable and minimal.
3. Do not duplicate shared utility logic across domain files.
4. Add compatibility alias handling only when required by migration.
5. Update local cases when a data-shape change could break planning or rendering.

High-risk changes requiring extra checks:

1. Renaming template IDs.
2. Renaming agent IDs.
3. Changing source capability keys.
4. Changing summary payload structure.

## 6. Validation and Test Matrix

Run:

1. `npm run lint`
2. `npm run build`

Manual smoke tests:

1. Switch domain in settings, return home, verify fallback list belongs to selected domain.
2. Open one local case and run analysis with animation on.
3. Open one local case and run analysis with animation off.
4. Interrupt analysis, return home, re-enter, continue unfinished run.
5. Complete analysis, verify history card renders summary distribution/cards.
6. Re-open history record and verify detail page match resolution works.

## 7. Release Readiness Criteria

A domain extension is release-ready only if all checks pass:

1. Structural completeness checklist (Section 3) is fully satisfied.
2. Built-in module validator passes at app startup.
3. No unresolved agent/template IDs in plan execution.
4. No runtime exceptions in domain switch and history/resume flows.
5. Summary card UI still works for old football records and new domain records.
6. Build and lint pass in CI or local equivalent.

## 8. Rollback Strategy

If a new domain release is unstable:

1. Remove or move `src/services/domains/modules/<domainId>/module.ts` out of the auto-discovery path.
2. Keep domain code in tree if needed, but ensure auto-discovery does not pick it up.
3. Keep compatibility shims untouched.
4. Re-run lint/build and smoke tests on remaining domains.

If a template or agent breaks only one route:

1. Temporarily route strategy to a safer template.
2. Or constrain `allowedAgentTypes` to stable subset.
3. Keep fallback plan executable at all times.

## 9. Common Failure Modes and Fix Hints

### 9.1 Domain switch has no visible effect

Check:

1. `activeDomainId` is persisted in settings.
2. Home fallback reads `getActiveAnalysisDomain().id`.
3. MatchDetail resolves active domain on render, not stale memo.

### 9.2 "Match not found" when opening history

Check:

1. Detail fallback chain includes history/saved/resume/local cases.
2. Resume state contains `matchSnapshot`.
3. Local test-case lookup by ID can resolve current record.

### 9.3 New domain fails startup with local case error

Cause:

1. Fewer than 3 local test cases.
2. Empty or duplicate case IDs.

Fix:

1. Add or repair local cases in `localCases.ts`.

### 9.4 Plan references unknown agent/template

Check:

1. Agent IDs in templates exist in discovered `DOMAIN_AGENT_ENTRIES`.
2. Template IDs referenced by strategy exist in discovered `DOMAIN_TEMPLATE_ENTRIES`.
3. Extension auto-install is not silently relied on for built-in core routes.

## 10. Reference Files

Core files to keep open while extending domains:

1. `src/services/domains/builtinModules.ts`
2. `src/services/domains/registry.ts`
3. `src/services/domains/planning/registry.ts`
4. `src/services/ai/planning.ts`
5. `src/agents/index.ts`
6. `src/skills/planner/index.ts`
7. `src/services/remotion/templateParams.ts`
8. `src/services/analysisSummary.ts`
9. `src/pages/Home.tsx`
10. `src/pages/MatchDetail.tsx`
11. `src/pages/Settings.tsx`
12. `src/contexts/AnalysisContext.tsx`
