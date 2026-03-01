# MatchFlow Architecture Map (2026-03-01)

This document is the current repository audit for maintenance and extension planning.

## 1. Repository Snapshot

### 1.1 Top-Level Directories

| Path | Purpose | Notes |
|---|---|---|
| `src/` | Main React + Capacitor app source | Core product logic lives here |
| `match-data-server/` | Optional Express + PostgreSQL service | Match API + admin API |
| `android/` | Capacitor Android wrapper project | Mostly generated/native host |
| `ios/` | Capacitor iOS wrapper project | Mostly generated/native host |
| `assets/` | Capacitor icon/splash sources | Used by asset generation |
| `dist/` | Vite build artifacts | Generated |
| `node_modules/` | Dependencies | Generated |

### 1.2 Top-Level Files

| File | Purpose |
|---|---|
| `.editorconfig` | Editor baseline settings |
| `.env.example` | Environment variable template |
| `.gitignore` | Git ignore rules |
| `README.md` | Project overview + quick start |
| `PROJECT_GUIDE.md` | Product/runtime guide |
| `AI_AGENT_FRAMEWORK.md` | Agent architecture explanation |
| `DEVELOPMENT.md` | Development/deployment notes |
| `I18N_PLAN.md` | i18n planning and guardrails |
| `CHANGELOG.md` | Change log |
| `ARCHITECTURE_MAP.md` | Current architecture audit |
| `capacitor.config.ts` | Capacitor app config |
| `vite.config.ts` | Vite bundling/runtime config |
| `tsconfig.json` | TypeScript config |
| `package.json` | Scripts + dependencies |
| `index.html` | Vite entry HTML |
| `metadata.json` | Project metadata |
| `数据分析Agent修改指南.md` | Agent extension guide |
| `赛事数据服务端接口指南.md` | Server API guide |
| `赛事数据源扩展指南.md` | Data source extension guide |

## 2. Frontend (`src/`) File Inventory

### 2.1 Root Files

| File | Purpose |
|---|---|
| `src/main.tsx` | App bootstrap, mounts React, initializes i18n |
| `src/App.tsx` | Router, error boundary, platform-level app behavior |
| `src/index.css` | Global styles and utility layers |

### 2.2 `src/agents/`

| File | Purpose |
|---|---|
| `src/agents/types.ts` | Agent context/config interfaces |
| `src/agents/index.ts` | Agent registry + `getAgent` lookup |
| `src/agents/prompts.ts` | Shared EN/ZH segment prompt template |
| `src/agents/utils.ts` | Common prompt builder and context-mode handling |
| `src/agents/overview.ts` | Match intro/context segment agent |
| `src/agents/stats.ts` | Statistical analysis segment agent |
| `src/agents/tactical.ts` | Tactical/formation segment agent |
| `src/agents/odds.ts` | Odds and market interpretation agent |
| `src/agents/prediction.ts` | Final prediction segment agent |
| `src/agents/general.ts` | Fallback generic analysis agent |
| `src/agents/planner_template.ts` | Tool-driven template planner agent |
| `src/agents/planner_autonomous.ts` | Autonomous freeform planner agent |
| `src/agents/tag.ts` | Segment tag extraction agent |
| `src/agents/summary.ts` | Final report summary + prediction JSON agent |
| `src/agents/animation.ts` | Animation payload extraction agent |

### 2.3 `src/components/`

| File | Purpose |
|---|---|
| `src/components/RemotionPlayer.tsx` | Validate + render animation payload with Remotion |
| `src/components/ui/Button.tsx` | Shared button primitive |
| `src/components/ui/Card.tsx` | Shared card primitives |
| `src/components/ui/Select.tsx` | Shared select/dropdown primitive |

### 2.4 `src/config/`

| File | Purpose |
|---|---|
| `src/config/agentModelConfig.ts` | Per-agent provider/model configuration for config mode |

### 2.5 `src/contexts/`

| File | Purpose |
|---|---|
| `src/contexts/AnalysisContext.tsx` | Analysis lifecycle state, streaming state, resume handling |

### 2.6 `src/data/`

| File | Purpose |
|---|---|
| `src/data/matches.ts` | Mock match schema and fixture data |

### 2.7 `src/docs/`

| File | Purpose |
|---|---|
| `src/docs/AGENT_GUIDE.md` | Internal guide for extending/maintaining agents |

### 2.8 `src/i18n/`

| File | Purpose |
|---|---|
| `src/i18n/config.ts` | i18next runtime initialization |
| `src/i18n/index.ts` | Compatibility re-export of i18n config |
| `src/i18n/locales/en.json` | English locale dictionary |
| `src/i18n/locales/zh.json` | Chinese locale dictionary |

### 2.9 `src/lib/`

| File | Purpose |
|---|---|
| `src/lib/utils.ts` | Utility helpers (class merging etc.) |

### 2.10 `src/pages/`

| File | Purpose | Size/Status |
|---|---|---|
| `src/pages/Home.tsx` | Home listing, filters, history/saved entry point | Medium-large |
| `src/pages/MatchDetail.tsx` | Source selection, editable payload, analysis stream UI, export/share | Very large (hotspot) |
| `src/pages/Settings.tsx` | AI/model settings, provider keys, language, data source config test | Large (hotspot) |
| `src/pages/Scan.tsx` | QR scanning and import path | Focused |
| `src/pages/Share.tsx` | Shared link parsing and import/analysis handoff | Medium |

### 2.11 `src/services/`

| File | Purpose | Size/Status |
|---|---|---|
| `src/services/ai.ts` | Model routing, planning, tool-calls, streaming orchestration | Very large (hotspot) |
| `src/services/dataSources.ts` | Declarative data source schema + capability derivation | Core abstraction for adaptive UI |
| `src/services/settings.ts` | Typed settings schema + persistence |
| `src/services/matchData.ts` | Match list service + fallback behavior |
| `src/services/history.ts` | Analysis history + resume state persistence |
| `src/services/savedMatches.ts` | Saved matches persistence |
| `src/services/db.ts` | SQLite initialization and DB schema setup |
| `src/services/agentParser.ts` | Incremental parser for tagged LLM stream blocks |
| `src/services/remotion/templateParams.ts` | Template contract + validation + normalization |
| `src/services/remotion/templates.tsx` | Template components and deterministic parameter filling |

### 2.12 `src/skills/`

| File | Purpose |
|---|---|
| `src/skills/types.ts` | Skill declaration/execution interfaces |
| `src/skills/index.ts` | Skill registry and dispatcher |
| `src/skills/calculator.ts` | Deterministic calculation skill |
| `src/skills/planner/types.ts` | Planner template type contract |
| `src/skills/planner/index.ts` | `select_plan_template` skill declaration/execution |
| `src/skills/planner/templates/basic.ts` | Basic plan template |
| `src/skills/planner/templates/standard.ts` | Standard plan template |
| `src/skills/planner/templates/odds_focused.ts` | Odds-focused template |
| `src/skills/planner/templates/comprehensive.ts` | Comprehensive template |

### 2.13 `src/utils/`

| File | Purpose |
|---|---|
| `src/utils/json.ts` | Robust JSON extraction from mixed LLM output |

## 3. Current Runtime Flow (Data Source -> Planner -> Agents)

### 3.1 Data Source Client Flow

1. `MatchDetail.tsx` renders source cards/forms from `ANALYSIS_DATA_SOURCES` (`src/services/dataSources.ts`).
2. User selections (`fundamental/market/custom`) are merged into `editableData` through each source's `applyToData/removeFromData`.
3. `sourceContext` is attached into payload:
- selected source flags
- selected source IDs
- derived capabilities (`hasFundamental/hasStats/hasOdds/hasCustom`)
- optional planning hints

### 3.2 Planning Route Flow

1. `src/services/ai.ts` computes route via `resolvePlanningRoute()`.
2. Route priority:
- explicit setting `enableAutonomousPlanning`
- explicit `sourceContext.planning` overrides
- automatic route from source capability signals
3. Deterministic template routes:
- `basic`
- `standard`
- `odds_focused`
- `comprehensive`
4. If deterministic path unavailable, planner agent fallback is used.

### 3.3 Agent Execution Flow

1. Plan segment decides `agentType` + `contextMode` + `animationType`.
2. Agent prompt is generated from `src/agents/*`.
3. Provider/model route is resolved per request:
- `global` mode: one provider/model for all agents
- `config` mode: per-agent mapping from `src/config/agentModelConfig.ts`, fallback to global
4. Streamed output is parsed into `<title>`, `<thought>`, `<tags>`, `<animation>`, `<summary>` blocks.
5. Animation output is validated and optionally auto-fixed before rendering.

### 3.4 Provider Compatibility Notes

- DeepSeek V3 (`deepseek-chat`) and R1 (`deepseek-reasoner`) are supported.
- OpenAI-compatible endpoints are supported with `/chat/completions` format.
- For reasoning/tool limitations, runtime includes fallback from native tool-calls to manual tool-call protocol.

## 4. Backend (`match-data-server/`) Inventory

| File | Purpose | Size/Status |
|---|---|---|
| `match-data-server/index.js` | Express app, routes, auth, DB/mock fallback, admin APIs | Very large (hotspot) |
| `match-data-server/db.js` | PG pool and health helpers | Small |
| `match-data-server/schema.sql` | DB schema and indexes | Stable |
| `match-data-server/package.json` | Server scripts/dependencies | Stable |
| `match-data-server/.env.example` | Server env template | Stable |
| `match-data-server/Dockerfile` | Image definition | Stable |
| `match-data-server/docker-compose.yml` | Local stack bootstrapping | Stable |
| `match-data-server/scripts/push_data_example.js` | Example data push script | Utility |
| `match-data-server/DEPLOY.md` | Deploy guide | Docs |
| `match-data-server/DATABASE_GUIDE.md` | DB maintenance guide | Docs |

## 5. Native Wrapper Notes

- `android/` and `ios/` are host wrappers for web build artifacts.
- Avoid placing business logic in native wrappers unless platform API integration is required.
- Generated web assets under native directories can contain stale build output; treat as generated artifacts.

## 6. Current Hotspots and Split Priorities

### 6.1 Hotspot Files (by line count)

- `src/pages/MatchDetail.tsx` (~1017)
- `src/services/ai.ts` (~1008)
- `src/pages/Settings.tsx` (~655)
- `src/pages/Home.tsx` (~468)
- `match-data-server/index.js` (~606)

### 6.2 Recommended Split Order

1. Split `src/services/ai.ts` first.
- Separate provider adapters, planning router, pipeline orchestrator, and animation fixer.

2. Split `src/pages/MatchDetail.tsx` second.
- Extract source-selector/form builder, stream panel, export/share, and resume logic into hooks/components.

3. Split `src/pages/Settings.tsx` third.
- Extract language/behavior/AI/data-source sections and connection test hooks.

4. Split `match-data-server/index.js` fourth.
- Extract routes/services/repositories/middleware.

5. Optionally split `src/pages/Home.tsx` fifth.
- Separate data loading/filtering from card rendering and action handlers.

## 7. Validation Status (2026-03-01)

- `npm run lint` passed (`tsc --noEmit`).
- `npm run build` passed (Vite production build).
- Encoding cleanup completed in agent prompts, planner templates, and locale dictionaries.
- Mojibake and replacement-char scan passed for source/docs (excluding generated native web artifacts).

## 8. Immediate Next Work Items

1. Add CI encoding guard (scan for replacement chars + common mojibake signatures).
2. Start `ai.ts` modularization with no behavior change.
3. Introduce tests around planning route decisions from `sourceContext` capability combinations.
4. Add i18n key parity check (`en.json` vs `zh.json`) as a CI step.
