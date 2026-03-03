# Domain Extension Go-Live Standard (v1) / 领域扩展上线标准（v1）

Date: 2026-03-03  
Scope: `MatchFlow/src` client only, no server code change in this round.

## 1. Goal / 目标

This standard defines the minimum bar for onboarding a new analysis domain into MatchFlow as a general-purpose analysis platform.

目标不是“能跑起来”，而是“可维护、可验证、可上线、可扩展”。

## 2. Required Deliverables for a New Domain / 新增领域必交付项

A new domain `<domainId>` must provide all items below:

1. Domain module (`domain + planning + localCases + module`) in `src/services/domains/modules/<domainId>/`.
2. Domain-specific home card presentation strategy in `src/services/domains/home/presenter.ts`.
3. Domain-specific history card semantics (labels, status, center display, search tokens).
4. Domain-specific analysis input/data-source contract (no sport-only assumptions).
5. Domain-specific planning strategy and planner agents.
6. Domain-specific planning templates.
7. Domain-specific animation templates (if animation is enabled for that domain).
8. Domain-specific analysis agents group and related skills.
9. Domain-specific final result rendering schema (must not assume match win-rate structure).
10. Domain i18n coverage for `en` and `zh` (UI labels, section names, source metadata, field labels, status text).

## 3. Hard Gates (Blocking) / 硬门禁（不满足即不可上线）

### G1. Module and registration consistency

1. `domain.id` is unique among built-in modules.
2. `planningStrategy.domainId === domain.id`.
3. Data source IDs are unique within the domain.

### G2. Local case baseline

1. Each built-in domain must provide at least 3 local test cases.
2. Local case IDs must be non-empty and unique.
3. Local cases should cover at least 3 meaningful scenario variants for regression.

### G3. Domain resource contract

1. `resources.templates` is non-empty.
2. `resources.animations` is non-empty.
3. `resources.agents` is non-empty.
4. `resources.skills` is non-empty.
5. Planner agent IDs from `planningStrategy.getPlannerAgentId("template" | "autonomous")` must exist in `resources.agents`.
6. `resources.agents` must include at least 3 non-planner analysis agents.
7. If `requiredTerminalAgentType` is defined, it must exist in `resources.agents`.

### G4. Domain semantics coverage

1. Home page must render domain semantics (no forced sports language such as `VS`, `live`, `match` for non-sports domains).
2. History cards must be navigable and stable after domain switching.
3. Final summary card must support non-versus/non-odds structures.

### G5. Quality checks

1. `npm.cmd run lint` passes.
2. `npm.cmd run build` passes.
3. Manual smoke tests pass for:
   - switch domain
   - start analysis
   - return from history
   - language switch (`en`/`zh`)
   - animation on/off path

## 4. Definition of Done (DoD) / 完成定义

A domain is considered go-live ready only when all of the following are true:

1. Functional chain complete: input -> planning -> execution -> result -> history -> replay.
2. Presentation chain complete: home + history + analysis + summary follow domain semantics.
3. i18n chain complete: no user-facing hardcoded text in both languages.
4. Validation chain complete: startup/runtime guards enforce resource and local-case contracts.
5. Regression chain complete: local cases support repeatable test runs.

## 5. Release Checklist Template / 上线检查清单模板

Use this checklist in PR description:

1. Domain module files added and registered.
2. Planner strategy and planner templates added.
3. Domain agents and skills added and registered.
4. Home/history/summary rendering adapted for domain semantics.
5. Local test cases >= 3 with unique IDs.
6. i18n keys added in `src/i18n/locales/en.json` and `src/i18n/locales/zh.json`.
7. Lint/build success.
8. Smoke test evidence attached (screenshots or brief logs).
9. No server code change in this client PR.

## 6. Suggested Delivery Phases / 推荐落地分期

### Phase 1 (now, mandatory)

1. Formalize v1 standard document.
2. Add strict built-in module startup validation.
3. Keep football-only baseline stable.

### Phase 2 (next)

1. Split domain UI renderer contracts (home/history/result).
2. Move domain-specific final summary schema behind pluggable renderers.

### Phase 3 (next)

1. Add domain scaffold generator (CLI/skill-driven).
2. Add automated compliance tests for go-live gates.

## 7. Server Alignment Notes (Client Perspective) / 服务端协作说明（客户端视角）

This standard is client-only for now, but server alignment should include:

1. Domain source capability schema contract.
2. Planner/agent/template identifiers shared with client.
3. Sample payloads for lightweight/standard/comprehensive scenarios.
4. Error model compatibility for history replay and partial analysis resumes.
