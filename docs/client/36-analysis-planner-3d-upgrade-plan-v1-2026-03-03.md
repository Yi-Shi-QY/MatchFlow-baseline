# Analysis UI 3D Planner Upgrade Plan (v1)

Date: 2026-03-03  
Scope: `MatchFlow/src` client analysis page (`MatchDetail`) and analysis runtime status pipeline (`AnalysisContext`, `services/ai`).

## 1. Goal

Replace the simple `init_engine` text placeholder with a 3D analysis planner visualization (Three.js) that:

1. Reflects real runtime progress and current stage.
2. Works for multiple analysis domains and different planning templates.
3. Degrades safely when WebGL is not available.
4. Preserves existing analysis cards and result flow.

## 2. Non-Negotiable Constraints

1. Domain-agnostic architecture first, visual polish second.
2. No football-only field coupling in planner runtime model.
3. Planner UI consumes only normalized graph/runtime contracts.
4. Existing analysis output compatibility must remain intact.
5. Mobile performance budget must be enforced.

## 3. Current Baseline (Before Development)

Current analysis UI state data already available:

1. `isAnalyzing`
2. `parsedStream.segments`
3. `planTotalSegments`
4. `planCompletedSegments`
5. `error`

Current gap:

1. Missing fine-grained runtime stages (planning, segment, animation, tag, summary, finalize).
2. No normalized planner graph model.
3. No 3D rendering layer.

## 4. Target Architecture

## 4.1 Runtime Status Contract (Domain Neutral)

Add unified runtime state contract:

```ts
export type PlannerStage =
  | 'booting'
  | 'planning'
  | 'segment_running'
  | 'animation_generating'
  | 'tag_generating'
  | 'summary_generating'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PlannerRuntimeState {
  stage: PlannerStage;
  runId: string;
  timestamp: number;
  segmentIndex: number;
  totalSegments: number;
  stageLabel?: string;
  activeAgentId?: string;
  activeSegmentTitle?: string;
  progressPercent: number;
  errorMessage?: string;
}
```

## 4.2 Domain Planner Adapter Contract

Each domain may provide its own planner graph mapping logic:

```ts
export interface DomainPlannerAdapter {
  domainId: string;
  buildGraph: (plan: any[], context: { language: 'zh' | 'en' }) => PlannerGraph;
  mapRuntimeState?: (input: PlannerRuntimeState) => PlannerRuntimeState;
}
```

Fallback rule:

1. If domain adapter exists, use it.
2. Otherwise use default generic adapter.

## 4.3 Planner Graph Contract

```ts
export interface PlannerNode {
  id: string;
  label: string;
  kind: 'stage' | 'segment';
  weight?: number;
}

export interface PlannerEdge {
  id: string;
  from: string;
  to: string;
}

export interface PlannerGraph {
  nodes: PlannerNode[];
  edges: PlannerEdge[];
}
```

## 4.4 UI Layer Split

1. `ThreeAnalysisPlanner`: pure visual component using `PlannerGraph + PlannerRuntimeState`.
2. `AnalysisPlannerFallback2D`: fallback component using same props.
3. `AnalysisPlannerRuntimeBridge`: transforms context state to normalized contracts.

No domain-specific conditional rendering inside the 3D component.

## 5. Runtime Event Pipeline

Emit runtime events in `streamAgentThoughts` around these boundaries:

1. Before `generateAnalysisPlan` => `planning`
2. For each segment start => `segment_running`
3. Before animation generation => `animation_generating`
4. Before tag generation => `tag_generating`
5. Before summary stream => `summary_generating`
6. Before persistence/finish => `finalizing`
7. Success => `completed`
8. Abort => `cancelled`
9. Error => `failed`

Context stores latest `PlannerRuntimeState` in `activeAnalyses[matchId]`.

## 6. 3D Visualization Requirements

1. Outer ring: fixed macro stages.
2. Inner ring: dynamic segment nodes from plan length.
3. Node color states: pending/running/completed/failed.
4. Active edge pulse to show current transition.
5. Center HUD text:
   - current stage
   - segment progress `i/n`
   - active segment title
6. Error state must be explicit and freeze progression animation.

## 7. Performance Budget

1. Mobile target >= 25 FPS in analysis state.
2. Clamp pixel ratio to <= 1.5.
3. Pause render loop when tab/page hidden.
4. Use `InstancedMesh` for segment nodes.
5. Lazy-load Three.js only in analysis page when needed.
6. Auto fallback to 2D on WebGL init failure.

## 8. Delivery Phases

## Phase 1: Contract and State Plumbing

Deliverables:

1. Runtime state types and adapter interfaces.
2. Event emission in `services/ai.ts`.
3. Context integration in `AnalysisContext`.
4. Unit-level mapper for state normalization.

Acceptance:

1. Runtime stage transitions correctly logged for success/cancel/error.
2. No domain hardcode in mapper and contract.

## Phase 2: 3D and Fallback UI

Deliverables:

1. `ThreeAnalysisPlanner` component.
2. `AnalysisPlannerFallback2D` component.
3. MatchDetail replacement for init placeholder.

Acceptance:

1. Stage and progress render correctly against live stream.
2. WebGL failure falls back gracefully.

## Phase 3: Domain Adapter Enablement

Deliverables:

1. Adapter registry in domain module system.
2. Default adapter + football adapter.
3. Compliance check: domain extension must not break planner rendering.

Acceptance:

1. New domain without adapter still works via default adapter.
2. Domain with adapter can customize graph semantics without touching UI core.

## Phase 4: Hardening

Deliverables:

1. Mobile performance tuning.
2. Error boundary and telemetry fields.
3. UX polish + i18n keys.

Acceptance:

1. No crash under repeated start/stop/resume.
2. FPS and memory meet budget on target devices.

## 9. Testing Plan

1. Functional:
   - start analysis
   - resume analysis
   - stop analysis
   - analysis failure
2. Domain compatibility:
   - football default
   - at least one non-football domain fixture
3. UI consistency:
   - stage progression vs real pipeline checkpoints
4. Performance:
   - 10-minute continuous analysis page render

## 10. Risks and Mitigation

1. Risk: stage mismatch due to async chunk timing.
   Mitigation: event-driven transitions from pipeline boundaries, not text parsing.
2. Risk: domain adapter drift.
   Mitigation: adapter interface + extension compliance check.
3. Risk: mobile GPU instability.
   Mitigation: feature gate + 2D fallback + throttling.

## 11. Baseline Freeze Definition (This Commit)

Baseline snapshot purpose:

1. Lock current client architecture status before 3D planner development.
2. Keep video export removed.
3. Keep domain extension scaffolding/compliance tools as current reference.

Baseline includes:

1. `src/` current client behavior.
2. `docs/client/` current architecture docs and this plan.
3. `scripts/` domain scaffold/compliance tooling.

Baseline excludes:

1. Android/iOS build artifacts and generated resources.
2. Local IDE/build output folders.

## 12. Development Start Criteria

Development can start when:

1. This plan is approved.
2. Baseline commit hash is recorded.
3. A dedicated feature branch is created from this baseline.
