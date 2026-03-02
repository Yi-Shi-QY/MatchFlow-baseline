# Web Admin Studio Upgrade Plan / Web 管理端能力升级计划

## EN

## 1. Date and Context

Kickoff date: **2026-03-02**.

Phase A contract freeze output:

1. [20-web-admin-phase-a-contract-freeze.md](./20-web-admin-phase-a-contract-freeze.md)

Current baseline:

1. Server 2.0 has auth foundation, permission filtering, and admin identity APIs.
2. Extension lifecycle exists at API level, but editing and release workflows are still API-first and not fully visualized.
3. Team needs a visual governance console for:
   - data sources
   - planning templates
   - animation templates
   - agents
   - skills
   - validation, testing, release

## 2. Upgrade Goal

Build a server-driven Web Admin Studio so operators can complete full authoring and release loops without manual SQL or direct manifest JSON editing in production.

## 3. Scope

In scope:

1. Visual editors for six governance domains.
2. Validation/test pipeline integrated into publish flow.
3. Versioning, channel release, rollback, and audit traceability.
4. Permission-gated collaboration (admin and editor roles).

Out of scope (this upgrade cycle):

1. WYSIWYG prompt generation by LLM.
2. Multi-cloud deployment orchestration.
3. External billing/commercial packaging.

## 4. Product Modules

## 4.1 Data Source Studio

Capabilities:

1. Create/edit source metadata and schema (labels, fields, defaults, apply/remove rules).
2. Preview generated form and resulting payload.
3. Validate source contract against `sourceContext` rules.

## 4.2 Planning Template Studio

Capabilities:

1. Visual segment builder for `segments[]`.
2. Bind required agents/skills and context mode.
3. Preview planner output and selected route behavior.

## 4.3 Animation Template Studio

Capabilities:

1. Manage animation template catalog and parameter schema.
2. Validate segment-to-animation compatibility.
3. Render preview snapshots for common scenarios.

## 4.4 Agent Studio

Capabilities:

1. Manage role prompt EN/ZH, context dependencies, and declared skills.
2. Validate prompt contract and output tags.
3. Check compatibility against templates that reference the agent.

## 4.5 Skill Studio

Capabilities:

1. Manage declaration schema and runtime alias config.
2. Validate alias target existence and parameter compatibility.
3. Simulate invocation with fixture payloads.

## 4.6 Validation and Release Center

Capabilities:

1. One-click validation bundle:
   - schema validation
   - dependency validation
   - compatibility validation
2. One-click test bundle:
   - contract tests
   - smoke tests
   - policy/permission tests
3. Publish and rollback by channel:
   - `internal`
   - `beta`
   - `stable`
4. Release records and audit timeline.

## 5. Target Architecture

## 5.1 Frontend

Recommended:

1. Separate app: `admin-studio-web` (workspace path: `match-data-server/admin-studio-web`).
2. Stack: React + TypeScript + route-level permission guards + form engine + diff viewer.
3. Main pages:
   - dashboard
   - catalog editors (6 domains)
   - validation jobs
   - release center
   - audit center

## 5.2 Backend APIs

Add/extend admin APIs:

1. Catalog APIs:
   - `/admin/catalog/datasources/*`
   - `/admin/catalog/planning-templates/*`
   - `/admin/catalog/animation-templates/*`
   - `/admin/catalog/agents/*`
   - `/admin/catalog/skills/*`
2. Validation APIs:
   - `/admin/validate/run`
   - `/admin/validate/:runId`
3. Release APIs:
   - `/admin/release/publish`
   - `/admin/release/rollback`
   - `/admin/release/history`

## 5.3 Data Model Additions

Add versioned revision tables:

1. `datasource_revisions`
2. `planning_template_revisions`
3. `animation_template_revisions`
4. `agent_revisions`
5. `skill_revisions`
6. `validation_runs`
7. `release_records`

Status model:

1. `draft`
2. `validated`
3. `published`
4. `deprecated`

## 6. Permission Model

Introduce explicit editor scopes:

1. `catalog:datasource:edit`
2. `catalog:template:edit`
3. `catalog:animation:edit`
4. `catalog:agent:edit`
5. `catalog:skill:edit`
6. `release:publish`
7. `release:rollback`
8. `audit:read`

Baseline policy:

1. `tenant_admin`: full editor + release + audit.
2. `analyst`: read-only catalog + validate run.
3. `super_admin`: cross-tenant governance.

## 7. Phase Plan (Concrete Dates)

## Phase A: Contract Freeze (2026-03-02 to 2026-03-04)

Deliverables:

1. Final API contract (OpenAPI draft).
2. Final revision and release schema draft.
3. Permission matrix for editor and release scopes.

## Phase B: Backend Foundation (2026-03-05 to 2026-03-10)

Deliverables:

1. Catalog CRUD APIs for 6 domains.
2. Validation run APIs and runner interface.
3. Publish/rollback APIs with audit records.

## Phase C: Web Studio MVP (2026-03-11 to 2026-03-18)

Deliverables:

1. Login/session + permission guards.
2. Data source/template/agent/skill editors.
3. Version diff and draft save.

## Phase D: Validation and Release UX (2026-03-19 to 2026-03-24)

Deliverables:

1. Validation center job UI.
2. Publish wizard with pre-check gate.
3. Rollback and release history UI.

## Phase E: Hardening and Rollout (2026-03-25 to 2026-03-31)

Deliverables:

1. E2E regression suite.
2. Performance and failure recovery checks.
3. Tenant-by-tenant rollout runbook.

## 7.1 Progress Snapshot (as of 2026-03-02)

| Phase | Status | Notes |
|---|---|---|
| Phase A: Contract Freeze | Completed | OpenAPI + migration draft delivered and reviewed in repo artifacts. |
| Phase B: Backend Foundation | Completed | Catalog/validate/release APIs, validation runner, publish gate, audit writes, and DB phase-gate tests passed. |
| Phase C: Web Studio MVP | Completed | Admin Studio page delivered with datasource/planning/animation/agent/skill structured builders, plus shared API client and route wiring. |
| Phase D: Validation and Release UX | Completed | Validation center + publish wizard gate + rollback/release history linkage delivered. |
| Phase E: Hardening and Rollout | Completed | Added executable phase-e hardening suite, performance/failure checks, and rollout runbook baseline for tenant-by-tenant release. |

Phase B completion evidence:

1. Contract and integration tests:
   - `npm test` (authz/no-db integration)
   - `npm run test:db-phase` (DB phase-gate suite)
2. Publish gate enforced server-side:
   - publish blocked when validation-run summary is missing/failed.
3. Full workflow validated in DB mode:
   - create -> validate -> publish -> rollback -> release history -> audit logs.

Phase C backend kickoff items (started):

1. `PUT /admin/catalog/:domain/:itemId/revisions/:version` for draft save.
2. `GET /admin/catalog/:domain/:itemId/diff` for manifest diff.
3. Delivered in latest backend slice:
   - Expanded strict validators to `animation_template`, `agent`, and `skill`.
   - Added integration coverage for invalid-manifest pre-write rejections in no-DB mode.
   - Added DB phase-gate coverage for create + validate success across these three domains.
4. Next slice for Phase C backend:
   - Add API-level examples for admin-web form engine integration.

## 7.2 Progress Update (as of 2026-03-02)

Phase C web MVP first slice delivered (initially in root app, later migrated to standalone admin web):

1. Added Admin Studio route and page:
   - Initial implementation path:
     - `src/pages/AdminStudio.tsx`
     - `src/App.tsx` route: `/admin-studio`
   - Current standalone path:
     - `match-data-server/admin-studio-web/src/pages/AdminStudio.tsx`
2. Added shared admin-web API client:
   - Current path:
     - `match-data-server/admin-studio-web/src/services/adminStudio.ts`
3. Implemented visual workflow for first vertical slice (all domains, datasource-first):
   - catalog entry list
   - revision list
   - draft manifest JSON editor + draft-save
   - revision diff viewer
   - validate run and result view
   - publish / rollback actions
   - release history view
4. Added entry point from home header in initial slice (later removed after standalone migration):
   - Initial path: `src/pages/Home.tsx`
5. Verification:
   - `npm run lint` passed
   - `npm run build` passed

## 7.3 Progress Update (as of 2026-03-02, later)

Phase C second slice + Phase D first slice delivered:

1. Planning template visual editor:
   - Added structured builder UI in `match-data-server/admin-studio-web/src/pages/AdminStudio.tsx` for:
     - template metadata (`id`, `name`, `rule`)
     - `requiredAgents` and `requiredSkills` (csv editor)
     - `segments[]` add/remove and per-segment fields
     - `contextMode` selection (`independent|build_upon|all`)
2. Builder and JSON consistency:
   - Builder auto-syncs to manifest JSON for draft-save/create-revision API calls.
   - Added `Load JSON` action to rebuild visual form state from raw JSON.
3. Publish wizard and gate:
   - Added inline publish wizard with gate details from `validationSummary`.
   - Explicitly blocks publish action in UI when validation-run summary is missing/failed.
   - Added guided actions: run validation -> confirm publish.
4. Validation center enhancement:
   - Added runId lookup in validation result panel to inspect any historical run record.
   - Supports manual replay checks before publish decision.
5. Release center enhancement:
   - Added channel filter and itemId search in release history panel for faster trace lookup.
   - Added release-record click linkage to associated `validationRunId` for quick validation replay.
6. Multi-domain editor enhancement:
   - Added structured builders for `animation_template`, `agent`, and `skill`.
   - Added builder-to-manifest sync and raw JSON reload path for these three domains.
7. Datasource editor enhancement:
   - Added structured builder for `datasource` metadata and `fields[]` path mapping.
   - Added builder-to-manifest sync and raw JSON reload path for `datasource`.
8. Datasource validation/preview enhancement:
   - Added local precheck cards for `schema/dependency/compatibility` aligned with server-side datasource checks.
   - Added `sourceContext` preview and payload skeleton preview to speed up editor self-verification before server validation.
9. Datasource form/rule builder enhancement:
   - Added visual editing for `labelKey`, `formSections[]` layout, and section-to-field binding (`fieldIds` mapping).
   - Added visual editing for `applyRules[]` and `removeRules[]` with target path/target fallback support.
10. Backend strict validation enhancement:
   - Expanded strict domain validators in `match-data-server/src/services/studioCatalogService.js` to:
     - `animation_template`
     - `agent`
     - `skill`
   - Added test coverage:
     - `match-data-server/test/runAuthzIntegration.js` invalid-manifest pre-write checks
     - `match-data-server/test/runDbPhaseGate.js` create+validate checks for the three domains
11. Verification:
   - `npm run lint` passed after this slice.
   - `npm run build` passed after this slice.
   - `cd match-data-server && npm test` passed after this slice.
   - `cd match-data-server && npm run test:db-phase` passed after this slice.

## 7.4 Progress Update (as of 2026-03-02, phase-e baseline)

Phase E hardening and rollout baseline delivered:

1. E2E regression entrypoint:
   - Added `match-data-server` script:
     - `npm run test:phase-e`
   - Added executable suite:
     - `match-data-server/test/runPhaseEHardening.js`
   - Coverage in this suite includes:
     - create+validate regression across all 5 strict-validation domains
     - datasource publish+rollback workflow smoke
2. Performance smoke checks:
   - Added latency p95 checks for:
     - `/health`
     - `/admin/catalog/datasource`
   - Supports threshold override:
     - `PHASE_E_HEALTH_P95_MAX_MS`
     - `PHASE_E_CATALOG_P95_MAX_MS`
3. Failure recovery checks:
   - Invalid request followed by valid request recovery path.
   - Service process restart recovery with persisted catalog revision readback.
4. Tenant rollout runbook:
   - Added `docs/21-server2-phase-e-rollout-runbook.md` for staged rollout + rollback gates.
5. Verification:
   - `cd match-data-server && npm run test:phase-e` passed.
   - `cd match-data-server && npm test` passed.
   - `cd match-data-server && npm run test:db-phase` passed.

## 7.5 Progress Update (as of 2026-03-02, joint-testing kickoff)

Client-server joint testing kickoff delivered:

1. Added executable joint smoke script:
   - `match-data-server/test/runClientServerJointSmoke.js`
   - `cd match-data-server && npm run test:joint-smoke`
2. Covered API-contract flow used by Admin Web:
   - list entries
   - list revisions
   - draft save
   - create revision
   - diff
   - validate run + runId lookup
   - publish
   - rollback
   - release history linkage
3. Next objective:
   - Add browser-level Admin Studio E2E (UI interactions) on top of current API-contract smoke.

## 7.6 Progress Update (as of 2026-03-02, web-client joint smoke)

Client-server joint testing second slice delivered:

1. Added executable web-client joint smoke command at repo root:
   - `npm run test:admin-web-joint-smoke`
2. Added runner:
   - `match-data-server/test/runAdminStudioWebJointSmoke.js`
3. Coverage through API-contract client flow aligned with admin-web client (`match-data-server/admin-studio-web/src/services/adminStudio.ts`):
   - strict-domain create/list/revision/validate across:
     - `datasource`
     - `planning_template`
     - `animation_template`
     - `agent`
     - `skill`
   - datasource draft save + revision diff
   - datasource publish + rollback + release history linkage
4. Next objective:
   - Add browser-level Admin Studio E2E (page interaction) on top of API-client joint smoke.

## 7.7 Progress Update (as of 2026-03-02, production-readiness baseline)

Server 2.0 production-readiness baseline delivered:

1. Runtime startup hardening:
   - Added startup validation for production mode in `match-data-server/src/config.js`
   - Rejects weak/default secrets and missing DB URL in production mode
2. Health and readiness endpoints:
   - Added `/livez` and `/readyz` in `match-data-server/index.js`
   - `/readyz` now performs real DB ping checks
3. Security and ops hardening:
   - Added baseline security headers (`nosniff`, `DENY`, `no-referrer`)
   - Added graceful shutdown for `SIGTERM`/`SIGINT` with DB pool close
4. Container hardening:
   - Added app healthcheck against `/readyz` in Dockerfile and compose
   - Added DB SSL mode controls for production/local compatibility
5. Production gate commands:
   - Added:
     - `npm run test:prod-ready`
     - `npm run preflight:prod`
   - Added checklist document:
     - `docs/22-server2-production-readiness-checklist.md`
6. Next objective:
   - Start browser-level Admin Studio E2E on top of production-ready runtime baseline.

## 7.8 Progress Update (as of 2026-03-02, admin-studio architecture split)

Admin Studio has been separated from MatchFlow client app and aligned with server-side ownership:

1. Removed Admin Studio embedding from MatchFlow client app:
   - removed route `/admin-studio` from `src/App.tsx`
   - removed home-header entry from `src/pages/Home.tsx`
2. Removed admin-studio page/client code from client app scope:
   - removed `src/pages/AdminStudio.tsx`
   - removed `src/services/adminStudio.ts`
3. Added standalone admin web app colocated with server:
   - `match-data-server/admin-studio-web`
   - includes:
     - dedicated `package.json`
     - Vite/TypeScript config
     - migrated Admin Studio page and API client
4. Added server-side helper scripts for standalone admin web:
   - `npm run admin-web:dev`
   - `npm run admin-web:build`
   - `npm run admin-web:lint`
5. Next objective:
   - Add browser-level E2E baseline against standalone `admin-studio-web`.

## 7.9 Progress Update (as of 2026-03-02, browser-level e2e baseline)

Browser-level Admin Studio E2E baseline delivered:

1. Added Playwright test runtime in standalone admin web:
   - `match-data-server/admin-studio-web/playwright.config.ts`
   - `match-data-server/admin-studio-web/e2e/datasource-governance.spec.ts`
2. Added first full governance-loop browser spec:
   - create item
   - run validation
   - publish via wizard gate
   - rollback
   - verify release history linkage
3. Added stable test selectors in Admin Studio UI:
   - `data-testid` markers for connection settings, create-item form, publish wizard, rollback action, and release history list
4. Added runnable commands:
   - `cd match-data-server && npm run admin-web:e2e:install`
   - `cd match-data-server && npm run admin-web:e2e`
   - `cd match-data-server/admin-studio-web && npm run test:e2e`
5. Next objective:
   - Extend browser E2E coverage for role/permission scenarios and multi-domain matrix.

## 7.10 Progress Update (as of 2026-03-02, browser-level e2e coverage expansion)

Expanded browser-level Admin Studio E2E coverage delivered:

1. Added planning_template governance lifecycle E2E:
   - create item
   - run validation
   - publish
   - rollback
   - release history trace
2. Added permission-guard E2E:
   - create analyst user through admin API
   - login and use user access token in Admin Studio settings
   - verify `catalog:datasource:edit` enforcement blocks create-item action
3. Added domain selector test hooks for stable cross-domain switching in E2E.
4. Verification:
   - `cd match-data-server && npm run admin-web:e2e` passed with 3 browser tests:
     - datasource governance lifecycle
     - planning_template governance lifecycle
     - permission guard for catalog edit
5. Next objective:
   - Extend browser E2E matrix to remaining domains (`animation_template`, `agent`, `skill`) and role matrix (`publisher`, `admin`).

## 8. Definition of Done

Functional DoD:

1. All six domain editors can create draft, validate, publish, and rollback.
2. Publish is blocked when validation or dependency checks fail.
3. Every write operation produces audit log with actor and before/after snapshot.

Quality DoD:

1. Contract tests green for catalog/validate/release APIs.
2. Admin-web E2E green for one full governance loop.
3. No privilege escalation in permission tests.

## 9. Initial Execution Checklist

Commands (example):

```bash
# server
cd match-data-server
npm install
npm run dev

# run integration checks
npm test

# admin web (new app, when scaffolded)
cd match-data-server/admin-studio-web
npm install
npm run dev
```

Expected outcomes:

1. Server health check returns `status=ok`.
2. Admin APIs pass auth + permission checks.
3. Validation run API returns runnable job IDs.
4. Publish API writes release record and audit log.

## 10. Risks and Mitigations

1. Risk: editor complexity causes low delivery speed.
   - Mitigation: ship by domain slices; keep a shared form/diff/validation framework.
2. Risk: broken releases due to dependency mismatch.
   - Mitigation: enforce dependency graph checks before publish.
3. Risk: policy drift between web and server.
   - Mitigation: server-side final authority + contract tests + permission matrix snapshots.

## ZH

## 1. 日期与背景

启动日期：**2026-03-02**。

阶段 A 契约冻结产物：

1. [20-web-admin-phase-a-contract-freeze.md](./20-web-admin-phase-a-contract-freeze.md)

当前基线：

1. 服务端 2.0 已具备认证基础、权限过滤和管理身份 API。
2. 扩展生命周期在 API 层可用，但编辑和发布流程还不够可视化。
3. 现在需要一个可视化治理后台，覆盖：
   - 信息源
   - 计划模板
   - 动画模板
   - agents
   - skills
   - 验证、测试、发布

## 2. 升级目标

构建“服务端驱动”的 Web 管理工作台，让运营和研发在不直接改生产 JSON/SQL 的前提下完成完整的编辑、验证、发布、回滚闭环。

## 3. 范围

本次纳入：

1. 六大治理域的可视化编辑器。
2. 验证/测试流水线接入发布流程。
3. 版本化、分渠道发布、回滚、审计追踪。
4. 基于权限的协作模型（管理员与编辑角色）。

本次不纳入：

1. 基于 LLM 的自动提示词生成器。
2. 多云编排与跨区域部署。
3. 商业化计费体系。

## 4. 产品模块

## 4.1 信息源工作台

能力：

1. 可视化编辑信息源元数据与字段 schema（标签、默认值、apply/remove 规则）。
2. 实时预览表单生成效果与 payload 结果。
3. 校验 `sourceContext` 契约一致性。

## 4.2 计划模板工作台

能力：

1. 可视化分段编辑器（`segments[]`）。
2. 绑定 required agents/skills 与 contextMode。
3. 预览规划器路由与产出结构。

## 4.3 动画模板工作台

能力：

1. 管理动画模板目录与参数 schema。
2. 校验“分段到动画”的映射兼容性。
3. 提供常见场景的渲染预览。

## 4.4 Agent 工作台

能力：

1. 管理 EN/ZH role prompt、依赖上下文和技能声明。
2. 校验 prompt 契约和输出标签。
3. 检查与模板引用关系的兼容性。

## 4.5 Skill 工作台

能力：

1. 管理 declaration schema 与 alias runtime 配置。
2. 校验 alias 目标存在与参数兼容性。
3. 使用固定夹具做调用模拟。

## 4.6 验证与发布中心

能力：

1. 一键验证包：
   - schema 校验
   - 依赖校验
   - 兼容性校验
2. 一键测试包：
   - 契约测试
   - 冒烟测试
   - 权限策略测试
3. 分渠道发布与回滚：
   - `internal`
   - `beta`
   - `stable`
4. 发布记录与审计时间线。

## 5. 目标架构

## 5.1 前端

建议：

1. 独立项目：`admin-studio-web`（工作区路径：`match-data-server/admin-studio-web`）。
2. 技术栈：React + TypeScript + 路由级权限守卫 + 表单引擎 + diff 组件。
3. 页面：
   - 总览看板
   - 六类目录编辑器
   - 验证中心
   - 发布中心
   - 审计中心

## 5.2 后端 API

新增/扩展：

1. 目录 API：
   - `/admin/catalog/datasources/*`
   - `/admin/catalog/planning-templates/*`
   - `/admin/catalog/animation-templates/*`
   - `/admin/catalog/agents/*`
   - `/admin/catalog/skills/*`
2. 验证 API：
   - `/admin/validate/run`
   - `/admin/validate/:runId`
3. 发布 API：
   - `/admin/release/publish`
   - `/admin/release/rollback`
   - `/admin/release/history`

## 5.3 数据模型增量

新增版本化表：

1. `datasource_revisions`
2. `planning_template_revisions`
3. `animation_template_revisions`
4. `agent_revisions`
5. `skill_revisions`
6. `validation_runs`
7. `release_records`

状态模型：

1. `draft`
2. `validated`
3. `published`
4. `deprecated`

## 6. 权限模型

新增编辑/发布权限：

1. `catalog:datasource:edit`
2. `catalog:template:edit`
3. `catalog:animation:edit`
4. `catalog:agent:edit`
5. `catalog:skill:edit`
6. `release:publish`
7. `release:rollback`
8. `audit:read`

基线分配：

1. `tenant_admin`：完整编辑 + 发布回滚 + 审计读取。
2. `analyst`：目录只读 + 可触发验证。
3. `super_admin`：跨租户治理。

## 7. 分阶段计划（明确日期）

## 阶段 A：契约冻结（2026-03-02 到 2026-03-04）

交付：

1. API 契约（OpenAPI 草案）。
2. 修订表与发布表 schema 草案。
3. 编辑/发布权限矩阵。

## 阶段 B：后端基础能力（2026-03-05 到 2026-03-10）

交付：

1. 六类目录 CRUD API。
2. 验证运行 API 与 runner 接口。
3. 发布/回滚 API + 审计落库。

## 阶段 C：Web Studio MVP（2026-03-11 到 2026-03-18）

交付：

1. 登录会话与权限守卫。
2. 信息源/模板/agent/skill 可视化编辑器。
3. 版本 diff 与草稿保存。

## 阶段 D：验证与发布体验（2026-03-19 到 2026-03-24）

交付：

1. 验证中心任务页面。
2. 带预检查门禁的发布向导。
3. 回滚与发布历史页面。

## 阶段 E：加固与上线（2026-03-25 到 2026-03-31）

交付：

1. E2E 回归测试套件。
2. 性能与故障恢复验证。
3. 分租户灰度上线 Runbook。

## 8. 完成定义

功能 DoD：

1. 六类编辑器均可完成草稿、验证、发布、回滚。
2. 验证或依赖检查失败时，发布必须被阻断。
3. 所有写操作都写审计（操作者 + 前后快照）。

质量 DoD：

1. 目录/验证/发布 API 契约测试通过。
2. 管理后台 E2E 完成一条完整治理链路。
3. 权限测试无越权路径。

## 9. 首轮执行清单

命令示例：

```bash
# 服务端
cd match-data-server
npm install
npm run dev

# 运行集成检查
npm test

# 管理端（新项目）
cd match-data-server/admin-studio-web
npm install
npm run dev
```

预期结果：

1. 健康检查返回 `status=ok`。
2. 管理 API 通过认证与权限门禁验证。
3. 验证 API 能返回可追踪的任务 ID。
4. 发布 API 可落 release record 与 audit log。

## 10. 风险与缓解

1. 风险：编辑器复杂度高，交付变慢。
   - 缓解：按域分片上线，复用统一表单/diff/校验框架。
2. 风险：依赖关系错误导致发布事故。
   - 缓解：发布前强制执行依赖图检查。
3. 风险：前后端权限认知漂移。
   - 缓解：服务端最终裁决 + 契约测试 + 权限矩阵快照。
