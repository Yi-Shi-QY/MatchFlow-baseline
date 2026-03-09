# Client Performance and Maintainability Optimization Plan (v1)

Date: 2026-03-09  
Scope: `MatchFlow/src` client only (no server behavior changes in this round)

## 1. Objective

This plan defines a behavior-preserving optimization roadmap to improve:

1. Client startup/load performance (bundle size and route loading).
2. Code maintainability (file size, responsibility boundaries, refactor safety).
3. Delivery confidence (type safety and automated regression checks).
4. Compatibility for multimodal analysis input and output contracts.

The target is not feature expansion.  
The target is to make the current football baseline faster and safer to evolve.

## 2. Current Baseline (as of 2026-03-09)

### 2.1 Build Output Baseline

From latest local production build:

1. `dist/assets/index-DSXoQJS0.js`: `1,992,425` bytes
2. `dist/assets/three.module-v4w2woeG.js`: `704,187` bytes
3. `dist/assets/html2canvas.esm-QH1iLAAe.js`: `202,379` bytes

Build currently warns about large chunks (>= 500 kB).

### 2.2 Architecture Hotspots

Current large-file hotspots:

1. `src/pages/MatchDetail.tsx`: `1583` lines
2. `src/pages/Settings.tsx`: `1061` lines
3. `src/services/ai.ts`: `889` lines
4. `src/services/history.ts`: `866` lines
5. `src/pages/Home.tsx`: `777` lines
6. `src/contexts/AnalysisContext.tsx`: `751` lines

These files currently combine multiple responsibilities (UI rendering, orchestration, persistence, export, notifications), making small changes harder to isolate.

### 2.3 Type and Test Baseline

1. `any` usage remains high in critical orchestration and page paths.
2. Client has no dedicated unit/integration test script in `package.json` (current test scripts are admin-web focused).

## 3. Non-Negotiable Constraints

1. No user-visible behavior regression for analysis flow and history/resume flow.
2. No breaking changes to existing persisted data or route compatibility.
3. Keep domain auto-discovery and fail-fast registration contracts intact.
4. Existing text-only analysis flow must remain fully available as default fallback.
5. Every phase must pass:
   - `npm.cmd run verify:domain-extension`
   - `npm.cmd run lint`
   - `npm.cmd run build`

## 4. Scope and Non-Scope

### 4.1 In Scope

1. Route-level lazy loading and chunk strategy optimization.
2. Dynamic import for heavy optional dependencies.
3. Client module extraction/refactor for large files.
4. Type tightening for analysis runtime contracts.
5. Add basic automated tests for client critical paths.
6. Multimodal input/output compatibility layer with graceful provider fallback.

### 4.2 Out of Scope

1. Server API/schema changes.
2. Domain feature expansion (new domain onboarding not in this plan).
3. UI redesign or interaction model changes.
4. Mandatory rollout of specific multimodal model providers in this round.

## 5. Phased Roadmap

## Phase A: Performance Quick Wins (PR-1)

Goal: reduce initial JS cost without changing behavior.

Deliverables:

1. Route-level lazy loading for non-home pages in `src/App.tsx`.
2. `vite.config.ts` chunk strategy (`manualChunks`) for heavy vendor groups.
3. Dynamic import for PDF/share/export-heavy dependencies in `MatchDetail` export path.
4. Keep current Three.js dynamic import pattern as baseline reference.

Acceptance criteria:

1. Main app chunk size reduced by at least 25% from current baseline.
2. No route navigation regression (home -> subject -> export/share).
3. Build warning count for large chunks reduced or isolated to expected optional paths.

## Phase B: Structural Decomposition (PR-2, PR-3)

Goal: reduce coupling and make refactors safer.

Deliverables:

1. Split `MatchDetail` into feature modules:
   - data loading/resolution
   - analysis runtime controls
   - export/share
2. Split `services/ai.ts` into:
   - planning route/capability preparation
   - segment orchestration/runtime stream
   - summary and animation pipeline helpers
3. Extract `AnalysisContext` side concerns:
   - notification adapter
   - resume persistence adapter

Acceptance criteria:

1. `MatchDetail.tsx` and `services/ai.ts` each reduced below 900 lines.
2. New module boundaries are documented and have no circular imports.
3. Analysis start/stop/resume smoke flow matches pre-refactor behavior.

## Phase C: Type and Test Hardening (PR-4)

Goal: improve correctness confidence.

Deliverables:

1. Introduce typed contracts for:
   - analysis payload
   - normalized segment plan
   - editable subject data form model
2. Reduce `any` usage in critical client runtime files.
3. Add client test tooling (`vitest`) and baseline tests:
   - discovery/fail-fast contract tests
   - planning route compatibility tests
   - template compatibility tests
   - history normalization tests

Acceptance criteria:

1. `any` usage in target critical files reduced by at least 40%.
2. `npm run test` available and green in local/CI baseline.
3. Regression cases for domain contracts and planning selection covered by automated tests.

## Phase D: Multimodal Input/Output Compatibility (PR-5)

Goal: support multimodal payloads without breaking existing text-first pipeline.

Deliverables:

1. Define normalized multimodal input contract for analysis request assembly, including:
   - text parts
   - image references (url/base64 + mime)
   - audio/video/file references with optional extracted text
2. Add provider capability routing so unsupported multimodal payloads are downgraded to text-compatible format with explicit logs.
3. Define normalized multimodal output envelope for UI and persistence, including:
   - markdown/text summary
   - structured render blocks (text/table/chart/image/reference)
   - optional raw provider payload snapshot for debugging
4. Keep planner, history, and resume contracts backward-compatible with text-only records.
5. Add compatibility tests for:
   - text-only input (legacy path)
   - mixed text+image input
   - provider fallback from multimodal to text mode

Acceptance criteria:

1. Text-only requests and historical records behave exactly as before.
2. Mixed multimodal requests are accepted by contract layer and either executed natively or downgraded deterministically.
3. Saved history/resume payloads for multimodal runs are readable by existing pages without runtime errors.
4. At least one end-to-end smoke case validates multimodal input to final summary rendering path.

## 6. PR Sequencing and Review Strategy

Recommended PR order:

1. PR-1: performance quick wins only.
2. PR-2: MatchDetail decomposition.
3. PR-3: `services/ai.ts` and `AnalysisContext` decomposition.
4. PR-4: typing and tests.
5. PR-5: multimodal input/output compatibility layer.

Review policy:

1. One optimization theme per PR.
2. No mixed feature changes.
3. Each PR includes before/after metrics and smoke checklist evidence.

## 7. Risk and Mitigation

1. Risk: lazy-loading introduces route fallback flicker.
   Mitigation: define stable loading shell and keep minimum skeleton UI.
2. Risk: module split breaks orchestration sequence.
   Mitigation: keep stream event ordering contract unchanged and add snapshot-style tests.
3. Risk: dynamic import breaks native export paths.
   Mitigation: test web + native branch logic in export flow before merge.
4. Risk: multimodal payload shape drift across providers.
   Mitigation: enforce normalized adapter contracts and provider-capability downgrade path.

## 8. Rollback Strategy

If regressions occur:

1. Revert the affected PR only (keep other phases independent).
2. Keep fail-fast discovery contract changes untouched.
3. Restore previous static import path for the broken optional feature first, then re-optimize in a follow-up PR.
4. If multimodal path regresses, force runtime to text-only mode behind a feature flag and preserve persisted data readability.

## 9. Definition of Done (Plan Level)

This optimization plan is complete only when all are true:

1. Phase A/B/C/D acceptance criteria all pass.
2. Client runtime remains behavior-compatible in key flows:
   - home listing
   - analysis start/stop/resume
   - history reopen
   - export/share
   - multimodal request fallback and rendering
3. Baseline docs are updated with:
   - post-optimization bundle metrics
   - new module/file map
   - test command and coverage summary
   - multimodal compatibility matrix (supported/downgraded/unsupported)
