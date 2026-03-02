# Server Auth & Admin Roadmap / 服务端账号鉴权与管理后台路线图
## EN

## 1. Goal

Build a server-centered identity and authorization system so that:

1. Clients use user accounts instead of a single shared API key.
2. The server validates user permissions for every request.
3. The server returns different data sources and planning templates based on user role/policy.
4. A web admin console can manage users, roles, policies, data sources, templates, and publish workflow.

## 2. Scope

In scope:

1. Account system: login, session, refresh, logout, user profile.
2. Authorization model: tenant + role + permission policy.
3. Capability-driven APIs for data sources and template recommendations.
4. Admin web UI and admin APIs.
5. Audit logs and operational visibility for policy changes.

Out of scope (for first milestone):

1. Social login providers.
2. Complex ABAC rule DSL.
3. Billing/payment integration.

## 3. Current Baseline (as of 2026-03-01)

1. Server uses one static `API_KEY` middleware for all routes.
2. No user identity context is attached to request lifecycle.
3. Planning and extension APIs already exist and can be policy-filtered.
4. Admin routes exist, but only for data and extension manifests, not account governance.

## 4. Target Architecture

1. Identity layer:
   - `users`, `tenants`, `sessions`, JWT access token, refresh token rotation.
2. Authorization layer:
   - RBAC first (`roles`, `permissions`, `user_roles`, `role_permissions`).
   - Optional user override policy.
3. Capability layer:
   - Resolve `availableDataSources`, `availableTemplates`, `recommendedTemplates` per request.
4. Management layer:
   - Admin web app + admin APIs for identity and policy operations.
5. Audit layer:
   - Immutable audit records for all security-sensitive operations.

## 5. Phase Plan

## Phase 0: Contract & Model Freeze (2-3 days)

1. Finalize role model:
   - `super_admin`, `tenant_admin`, `analyst`, `viewer`.
2. Finalize permission naming convention:
   - `datasource:use:<id>`
   - `template:use:<id>`
   - `admin:*`
3. Finalize tenant isolation rules and default policy fallback.
4. Produce API and schema contract draft (OpenAPI + SQL draft).

Definition of done:

1. Approved contract doc.
2. Approved migration plan.

## Phase 1: Authentication Foundation (4-6 days)

1. Add auth endpoints:
   - `POST /auth/login`
   - `POST /auth/refresh`
   - `POST /auth/logout`
   - `GET /auth/me`
2. Add password hashing and token security:
   - Argon2 or bcrypt
   - refresh token hashing at rest
3. Introduce auth middleware that injects:
   - `req.authContext = { userId, tenantId, roles, permissions }`
4. Keep backward compatibility mode for legacy API key clients.

Definition of done:

1. Login/refresh/logout flow passes integration tests.
2. Legacy API key path still works for existing clients.

## Phase 2: Authorization & Capability Resolution (5-7 days)

1. Add policy tables and permission resolver service.
2. Add capability endpoint:
   - `GET /capabilities/me`
3. Apply permission filters to:
   - `/matches`
   - `/analysis/config/*`
   - `/hub/*`
4. Ensure template recommendation uses effective policy, not hardcoded rules.

Definition of done:

1. Different roles receive different data source/template sets.
2. Unauthorized template/data source access is blocked and logged.

## Phase 3: Admin API Expansion (5-7 days)

1. Add admin identity APIs:
   - user create/update/disable
   - role create/update
   - role-permission binding
2. Add policy APIs:
   - tenant policy set/get
   - optional user-level overrides
3. Add publish workflow for template/data source policy revisions.
4. Add audit log query API.

Definition of done:

1. Admin can manage identity and policy entirely via API.
2. All write operations produce audit records.

## Phase 4: Web Admin Console (7-10 days)

1. New frontend app (recommended: separate `match-admin-web`) or integrated admin module.
2. Core pages:
   - Login
   - User/role management
   - Data source catalog policy
   - Template catalog policy
   - Audit log viewer
3. Add permission matrix UI and safe update confirmation.
4. Add basic observability widgets (policy version, publish status, recent failures).

Definition of done:

1. Admin can finish full governance loop without manual SQL.
2. UI permission checks match server-side enforcement.

## Phase 5: Client Account Integration (4-6 days)

1. Add client login/session flow.
2. Fetch `GET /capabilities/me` on startup/session refresh.
3. Render analysis setup UI based on allowed data sources.
4. Use server-recommended templates constrained by permissions.

Definition of done:

1. Two test users with different roles see different analysis options.
2. Client behavior remains stable during token refresh and reconnect.

## Phase 6: Rollout & Migration (3-5 days)

1. Roll out by tenant/user groups.
2. Enable dual-mode auth during migration:
   - account token (new)
   - legacy API key (temporary compatibility)
3. Add runbook for rollback to previous policy version.
4. Remove legacy key-only mode after client migration completion.

Definition of done:

1. Production rollout with zero critical regression.
2. Legacy mode deprecation date announced and enforced.

## 6. Data Model (Minimum Set)

1. `tenants`
2. `users`
3. `roles`
4. `permissions`
5. `user_roles`
6. `role_permissions`
7. `tenant_datasource_policies`
8. `tenant_template_policies`
9. `user_policy_overrides` (optional in v1)
10. `sessions`
11. `audit_logs`

## 7. API Deliverables (Minimum Set)

1. Auth:
   - `POST /auth/login`
   - `POST /auth/refresh`
   - `POST /auth/logout`
   - `GET /auth/me`
2. Capability:
   - `GET /capabilities/me`
3. Admin Identity:
   - `/admin/users/*`
   - `/admin/roles/*`
   - `/admin/permissions/*`
4. Admin Policy:
   - `/admin/policies/datasources/*`
   - `/admin/policies/templates/*`
   - `/admin/audit-logs`

## 8. Security Requirements

1. Passwords never stored in plaintext.
2. Refresh tokens stored as hash.
3. Access token short TTL with rotation support.
4. Admin endpoints require explicit admin permission.
5. Audit logs are append-only.
6. Sensitive actions include actor, target, before/after snapshot.

## 9. Testing & Validation

1. Unit tests:
   - permission resolver
   - policy merge order
   - token lifecycle
2. Integration tests:
   - auth flow
   - capability filtering
   - unauthorized access rejection
3. E2E tests:
   - admin policy update -> client capability change
4. Non-functional:
   - latency target for `GET /capabilities/me`
   - failure recovery for token refresh and policy cache

## 10. Risks & Mitigations

1. Risk: policy model too complex for first release.
   - Mitigation: ship RBAC first, defer advanced ABAC.
2. Risk: client migration takes longer than expected.
   - Mitigation: keep dual auth mode with strict sunset plan.
3. Risk: accidental over-permission in admin operations.
   - Mitigation: deny-by-default + audit + approval flow for high-risk changes.

## 11. Milestone Acceptance

M1 (Auth base):

1. Login + refresh stable.
2. `/auth/me` available.

M2 (Policy delivery):

1. `/capabilities/me` live.
2. Route-level permission enforcement active.

M3 (Admin governance):

1. Admin UI can complete full policy lifecycle.
2. Audit trail is queryable and complete.

M4 (Client adoption):

1. Client uses account + capability-driven UI.
2. Legacy key-only mode retired by schedule.

## ZH

## 1. 目标

建立以服务端为中心的账号与权限体系，实现：

1. 客户端从“单一 API Key”切换到“用户账号会话”。
2. 服务端对每个请求进行权限校验。
3. 服务端按用户角色/策略下发不同的数据源与分析模板。
4. 通过 Web 管理后台统一管理用户、角色、策略、模板和发布流程。

## 2. 范围

本阶段包含：

1. 账号系统：登录、会话、刷新、退出、用户信息。
2. 权限模型：租户 + 角色 + 权限策略。
3. 能力下发接口：按账号返回可用数据源/模板/推荐模板。
4. 管理后台与管理 API。
5. 策略变更审计与可观测性。

本阶段不包含：

1. 社交登录。
2. 复杂 ABAC 规则 DSL。
3. 计费与支付系统。

## 3. 当前基线（截至 2026-03-01）

1. 服务端目前使用全局 `API_KEY` 鉴权。
2. 请求上下文中没有用户身份与权限信息。
3. 已有规划接口和 Hub 接口，可作为权限过滤承载层。
4. 现有 admin 路由偏数据管理，缺少账号与权限治理能力。

## 4. 目标架构

1. 身份层：
   - `users`、`tenants`、`sessions`、JWT access token、refresh token 轮转。
2. 授权层：
   - 先落 RBAC（`roles`、`permissions`、`user_roles`、`role_permissions`）。
   - 可选用户级覆盖策略。
3. 能力层：
   - 为每次请求计算 `availableDataSources`、`availableTemplates`、`recommendedTemplates`。
4. 管理层：
   - 管理后台 + 管理 API。
5. 审计层：
   - 对高风险操作写入不可篡改审计日志。

## 5. 分阶段计划

## 阶段 0：契约与模型冻结（2-3 天）

1. 角色模型定稿：
   - `super_admin`、`tenant_admin`、`analyst`、`viewer`。
2. 权限命名规则定稿：
   - `datasource:use:<id>`
   - `template:use:<id>`
   - `admin:*`
3. 租户隔离与默认策略回退规则定稿。
4. 输出 API 契约草案与 SQL 草案。

完成标准：

1. 契约评审通过。
2. 迁移方案评审通过。

## 阶段 1：认证底座（4-6 天）

1. 新增认证接口：
   - `POST /auth/login`
   - `POST /auth/refresh`
   - `POST /auth/logout`
   - `GET /auth/me`
2. 密码与令牌安全：
   - Argon2 或 bcrypt
   - refresh token 哈希存储
3. 鉴权中间件注入：
   - `req.authContext = { userId, tenantId, roles, permissions }`
4. 保留旧 API Key 兼容路径（迁移期）。

完成标准：

1. 登录刷新链路集成测试通过。
2. 旧客户端路径仍可用。

## 阶段 2：权限与能力下发（5-7 天）

1. 新增策略表与权限解析服务。
2. 新增能力接口：
   - `GET /capabilities/me`
3. 对以下接口进行权限过滤：
   - `/matches`
   - `/analysis/config/*`
   - `/hub/*`
4. 推荐模板逻辑改为基于有效策略计算。

完成标准：

1. 不同角色能拿到不同数据源和模板集合。
2. 越权访问被拒绝并有审计记录。

## 阶段 3：管理 API 扩展（5-7 天）

1. 账号与角色管理 API：
   - 用户创建/禁用/更新
   - 角色创建/更新
   - 角色权限绑定
2. 策略管理 API：
   - 租户级数据源策略
   - 租户级模板策略
   - 可选用户级覆盖
3. 增加策略发布与回滚版本流。
4. 增加审计查询接口。

完成标准：

1. 账号与策略可完全通过 API 管理。
2. 全量写操作均落审计日志。

## 阶段 4：Web 管理后台（7-10 天）

1. 新建管理前端（建议独立 `match-admin-web`）。
2. 核心页面：
   - 登录
   - 用户/角色管理
   - 数据源策略配置
   - 模板策略配置
   - 审计日志
3. 增加权限矩阵与高风险操作二次确认。
4. 增加基础运维视图（发布状态、策略版本、失败告警）。

完成标准：

1. 管理员无需手工 SQL 即可完成策略治理闭环。
2. 前端权限展示与服务端鉴权一致。

## 阶段 5：客户端账号接入（4-6 天）

1. 客户端新增登录/会话管理。
2. 启动和刷新时拉取 `GET /capabilities/me`。
3. 分析页按可用数据源动态渲染。
4. 模板推荐以服务端权限过滤后的结果为准。

完成标准：

1. 两个不同角色账号在客户端看到不同分析配置入口。
2. token 刷新和网络抖动下行为稳定。

## 阶段 6：灰度与迁移（3-5 天）

1. 按租户/用户分批开启新鉴权链路。
2. 迁移期双模式：
   - 新：账号 token
   - 旧：全局 API Key（临时）
3. 提供策略版本回滚运行手册。
4. 客户端完成迁移后下线旧模式。

完成标准：

1. 生产灰度无严重回归。
2. 旧模式下线时间明确并执行。

## 6. 最小数据模型

1. `tenants`
2. `users`
3. `roles`
4. `permissions`
5. `user_roles`
6. `role_permissions`
7. `tenant_datasource_policies`
8. `tenant_template_policies`
9. `user_policy_overrides`（v1 可选）
10. `sessions`
11. `audit_logs`

## 7. 最小 API 交付集

1. 认证接口：
   - `POST /auth/login`
   - `POST /auth/refresh`
   - `POST /auth/logout`
   - `GET /auth/me`
2. 能力接口：
   - `GET /capabilities/me`
3. 管理账号接口：
   - `/admin/users/*`
   - `/admin/roles/*`
   - `/admin/permissions/*`
4. 管理策略接口：
   - `/admin/policies/datasources/*`
   - `/admin/policies/templates/*`
   - `/admin/audit-logs`

## 8. 安全要求

1. 密码不得明文存储。
2. refresh token 必须哈希后存储。
3. access token 短有效期并支持轮转。
4. admin 接口必须显式 admin 权限。
5. 审计日志为追加写，不做覆盖更新。
6. 高风险操作需记录操作者、目标对象、变更前后快照。

## 9. 测试与校验

1. 单元测试：
   - 权限解析
   - 策略合并优先级
   - token 生命周期
2. 集成测试：
   - 认证链路
   - 能力下发过滤
   - 越权拒绝
3. 端到端测试：
   - 管理后台改策略 -> 客户端能力变化
4. 非功能验证：
   - `GET /capabilities/me` 延迟目标
   - token 刷新失败恢复与策略缓存失效恢复

## 10. 风险与缓解

1. 风险：首版策略模型过重。
   - 缓解：先上线 RBAC，再补 ABAC。
2. 风险：客户端迁移周期不可控。
   - 缓解：双模式过渡并设定强制下线时间。
3. 风险：管理端误配导致越权。
   - 缓解：默认拒绝 + 审计 + 高风险操作审批流程。

## 11. 里程碑验收

M1（认证基础）：

1. 登录 + 刷新稳定。
2. `/auth/me` 可用。

M2（权限下发）：

1. `/capabilities/me` 上线。
2. 路由级权限过滤生效。

M3（治理可用）：

1. 管理后台可完成策略全流程。
2. 审计日志完整可查询。

M4（客户端完成接入）：

1. 客户端启用账号 + 能力驱动 UI。
2. 旧 API Key-only 模式按计划退场。
