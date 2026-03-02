# Server 2.0 Phase E Rollout Runbook / 服务端 2.0 Phase E 上线执行手册

## EN

## 1. Purpose

This runbook defines how to execute Phase E hardening gates and roll out Server 2.0 admin-governance capability tenant by tenant.

Target outcomes:

1. E2E regression suite is green.
2. Performance and failure-recovery smoke checks are green.
3. Rollout can be halted or rolled back quickly with clear criteria.

## 2. Prerequisites

1. Docker database is running:

```bash
cd match-data-server
npm run db:up
```

2. Environment values are configured:

1. `DATABASE_URL` (defaults to `postgres://postgres:postgres@localhost:5432/matchflow` in phase-e script)
2. `API_KEY`
3. `ENABLE_ADMIN_STUDIO=true`
4. `ENABLE_SERVER2_PHASE_GATES=true`

3. Baseline migrations are already applied by DB bootstrap (or `POST /admin/init` has been executed).

## 3. Phase E Gate Commands

Run in this order:

```bash
cd match-data-server
npm test
npm run test:db-phase
npm run test:phase-e
npm run admin-web:e2e
npm run test:prod-ready
npm run preflight:prod
```

Expected results:

1. `npm test` summary ends with `0 failed`.
2. `npm run test:db-phase` summary ends with `0 failed`.
3. `npm run test:phase-e` summary ends with `0 failed`.
4. `npm run test:prod-ready` passes readiness endpoint and security-header checks.
5. `npm run preflight:prod` ends with `PASS`.

Optional stricter performance thresholds:

```bash
PHASE_E_HEALTH_P95_MAX_MS=220 \
PHASE_E_CATALOG_P95_MAX_MS=450 \
npm run test:phase-e
```

If local database does not support SSL:

```bash
DB_SSL_MODE=disable npm run preflight:prod
```

## 4. Tenant-by-Tenant Rollout

### Wave 0: Internal Tenant

1. Enable only `internal` release channel for target tenant.
2. Execute one full governance loop:
   - create draft
   - validate
   - publish to `internal`
   - rollback
3. Verify:
   - release history entries exist
   - validation runs are linked
   - audit logs include write actions

Exit criteria:

1. No P1/P2 defects.
2. No permission bypass findings.

### Wave 1: Beta Tenants

1. Choose 1-3 low-risk tenants.
2. Publish selected revisions to `beta`.
3. Monitor for at least one business cycle:
   - API error rate
   - validation failure ratio
   - rollback frequency

Exit criteria:

1. Error rate stable vs baseline.
2. No unresolved blocker defects.

### Wave 2: Stable Tenants

1. Gradually expand to remaining tenants.
2. Keep `internal` and `beta` channels as safety rails.
3. Continue daily review of release history and audit log integrity.

## 5. Rollback Triggers and Actions

Trigger rollback if any condition is met:

1. Permission regression or unauthorized data exposure.
2. Repeated publish failures caused by server-side validation mismatch.
3. API instability that impacts production governance operations.

Immediate actions:

1. Stop stable-channel publish for affected domain.
2. Roll back to last known good version via `/admin/catalog/:domain/:itemId/rollback`.
3. Capture incident snapshot:
   - `validationRunId`
   - release record id
   - audit log rows
4. Open hotfix branch and rerun Phase E gate commands before re-enable.

## 6. Post-Phase-E: Client-Server Joint Testing Entry

After Phase E is green, move to client-server integration testing with this checklist:

1. Web Admin flow:
   - create revision
   - diff
   - validate run lookup
   - publish wizard gate
   - rollback
2. Permission scenarios:
   - editor, validate-runner, release-reader, publisher, admin
3. Multi-domain coverage:
   - datasource/planning_template/animation_template/agent/skill
4. Data consistency:
   - revision status transitions
   - release history linkage
   - audit trace completeness
5. Standalone admin-web architecture:
   - Admin Studio runs from `match-data-server/admin-studio-web`
   - no embedded admin route in MatchFlow client app

Joint-smoke command (API-contract level):

```bash
cd match-data-server
npm run test:joint-smoke
```

Web-client joint-smoke command (web API client level):

```bash
cd match-data-server
npm run test:web-joint-smoke
```

Standalone admin-web local run:

```bash
cd match-data-server
npm run admin-web:dev
```

Browser-level admin-web E2E (Playwright):

```bash
cd match-data-server
npm run admin-web:e2e:install   # first-time browser install
npm run admin-web:e2e
```

Current browser E2E baseline covers:

1. Datasource governance lifecycle (create/validate/publish/rollback/history).
2. Planning-template governance lifecycle (create/validate/publish/rollback/history).
3. Permission guard scenario for `catalog:datasource:edit`.

## 7. Sign-Off Template

Record the following before rollout expansion:

1. Execution date/time.
2. Commit SHA.
3. Test command outputs (`test`, `test:db-phase`, `test:phase-e`).
4. Approvers (backend owner, web-admin owner, QA owner).

---

## ZH

## 1. 目标

本手册用于执行 Phase E 的加固验收，并按租户分批上线服务端 2.0 管理治理能力。

目标结果：

1. E2E 回归套件全绿。
2. 性能与故障恢复烟测全绿。
3. 具备明确的暂停和回滚标准。

## 2. 前置条件

1. 启动数据库容器：

```bash
cd match-data-server
npm run db:up
```

2. 环境变量已配置：

1. `DATABASE_URL`（phase-e 脚本默认 `postgres://postgres:postgres@localhost:5432/matchflow`）
2. `API_KEY`
3. `ENABLE_ADMIN_STUDIO=true`
4. `ENABLE_SERVER2_PHASE_GATES=true`

3. 数据库已完成初始化（由 bootstrap 自动执行或已执行 `/admin/init`）。

## 3. Phase E 验收命令

按顺序执行：

```bash
cd match-data-server
npm test
npm run test:db-phase
npm run test:phase-e
```

预期结果：

1. `npm test` 最终为 `0 failed`。
2. `npm run test:db-phase` 最终为 `0 failed`。
3. `npm run test:phase-e` 最终为 `0 failed`。

可选：收紧性能阈值

```bash
PHASE_E_HEALTH_P95_MAX_MS=220 \
PHASE_E_CATALOG_P95_MAX_MS=450 \
npm run test:phase-e
```

## 4. 分租户上线策略

### Wave 0：内部租户

1. 仅开放 `internal` 渠道。
2. 完整执行一条治理链路：
   - 创建草稿
   - 执行验证
   - 发布到 `internal`
   - 回滚
3. 核验：
   - release history 有记录
   - validation run 与发布记录可关联
   - audit 日志包含关键写操作

放行条件：

1. 无 P1/P2 问题。
2. 无越权风险。

### Wave 1：Beta 租户

1. 选择 1-3 个低风险租户。
2. 发布到 `beta` 渠道。
3. 观察至少一个业务周期：
   - API 错误率
   - 验证失败率
   - 回滚频率

放行条件：

1. 错误率与基线持平。
2. 无阻断缺陷未关闭。

### Wave 2：Stable 租户

1. 逐步扩展到其余租户。
2. 保留 `internal`、`beta` 作为安全缓冲。
3. 持续日检 release history 和 audit 完整性。

## 5. 回滚触发与动作

满足任一条件即触发回滚：

1. 出现越权或数据暴露风险。
2. 服务端验证与发布链路持续失败。
3. API 稳定性影响生产治理操作。

立即动作：

1. 停止受影响域的 stable 发布。
2. 使用 `/admin/catalog/:domain/:itemId/rollback` 回滚到上一稳定版本。
3. 记录故障快照：
   - `validationRunId`
   - release record id
   - audit 关键记录
4. 热修复后重新执行 Phase E 全套命令。

## 6. Phase E 后联调入口

Phase E 通过后，进入服务端-客户端联调，检查项：

1. Web Admin 主流程：
   - create revision
   - diff
   - validate run lookup
   - publish wizard gate
   - rollback
2. 权限场景：
   - editor、validate-runner、release-reader、publisher、admin
3. 多域覆盖：
   - datasource/planning_template/animation_template/agent/skill
4. 数据一致性：
   - revision 状态流转
   - release history 关联
   - audit 链路完整

联调烟测命令（API 契约层）：

```bash
cd match-data-server
npm run test:joint-smoke
```

## 7. 签收模板

扩面前需记录：

1. 执行时间。
2. 提交 SHA。
3. 三条命令输出（`test`、`test:db-phase`、`test:phase-e`）。
4. 签收人（后端负责人、Web 管理端负责人、QA 负责人）。
