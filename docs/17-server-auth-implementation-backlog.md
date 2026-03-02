# Server Auth Implementation Backlog / 服务端账号鉴权实施任务清单
## EN

## 1. Purpose

This document converts the roadmap into execution-ready tasks for Phase 0 and Phase 1.

Primary references:

1. [16-server-auth-and-admin-roadmap.md](./16-server-auth-and-admin-roadmap.md)
2. [08-server-api-guide.md](./08-server-api-guide.md)
3. [09-server-deploy-and-database-guide.md](./09-server-deploy-and-database-guide.md)

## 2. Delivery Window

1. Phase 0 (contract freeze): 2-3 days
2. Phase 1 (auth foundation): 4-6 days

## 3. Phase 0 Task Breakdown (Contract Freeze)

## 3.1 Role & Permission Contract

Tasks:

1. Define roles:
   - `super_admin`
   - `tenant_admin`
   - `analyst`
   - `viewer`
2. Define permission namespace:
   - `admin:*`
   - `datasource:use:<id>`
   - `template:use:<id>`
3. Define permission inheritance matrix.

Deliverables:

1. `docs/16-server-auth-and-admin-roadmap.md` finalized role/permission matrix appendix.
2. `docs/08-server-api-guide.md` updated auth section draft.

## 3.2 API Contract Draft

Tasks:

1. Define request/response schemas for:
   - `POST /auth/login`
   - `POST /auth/refresh`
   - `POST /auth/logout`
   - `GET /auth/me`
2. Define standard error envelope and error codes.
3. Define compatibility behavior for legacy API key requests.

Deliverables:

1. API contract markdown with JSON examples.
2. Error code table and migration notes.

## 3.3 Database Schema Draft

Tasks:

1. Add draft schema for:
   - `tenants`
   - `users`
   - `roles`
   - `permissions`
   - `user_roles`
   - `role_permissions`
   - `sessions`
   - `audit_logs`
2. Define unique constraints and indexes.
3. Define initial seed strategy for roles/permissions.

Deliverables:

1. SQL draft changes in `match-data-server/schema.sql` (or separate migration file).
2. Seed script design note.

## 3.4 Security Rules Freeze

Tasks:

1. Token TTL decision:
   - Access token: 15-30 minutes
   - Refresh token: 7-30 days
2. Password hash algorithm decision:
   - `argon2id` preferred, `bcrypt` fallback
3. Session invalidation and refresh rotation rules.

Deliverables:

1. Security decision record in docs.

## 4. Phase 1 Task Breakdown (Auth Foundation)

## 4.1 Server Code Structure Changes

Target folders:

1. `match-data-server/src/routes`
2. `match-data-server/src/middlewares`
3. `match-data-server/src/services`
4. `match-data-server/src/repositories`

New modules to add:

1. `src/routes/authRoutes.js`
2. `src/middlewares/authenticateUser.js`
3. `src/services/authService.js`
4. `src/repositories/userRepository.js`
5. `src/repositories/sessionRepository.js`

## 4.2 Endpoint Implementation Tasks

Tasks:

1. Implement `POST /auth/login`
   - verify user credentials
   - issue access + refresh token
   - persist refresh session hash
2. Implement `POST /auth/refresh`
   - verify refresh token
   - rotate refresh token
   - return new token pair
3. Implement `POST /auth/logout`
   - revoke current session
4. Implement `GET /auth/me`
   - return user profile + roles + tenant id

## 4.3 Middleware & Context Injection

Tasks:

1. Implement JWT parser and verification middleware.
2. Add `req.authContext`:
   - `userId`
   - `tenantId`
   - `roles`
   - `permissions`
3. Add dual-mode compatibility:
   - if JWT present -> user auth path
   - else if legacy `API_KEY` matches -> legacy path

## 4.4 Data Access Tasks

Tasks:

1. Create user query methods:
   - get by login identifier
   - get profile + roles + permissions
2. Create session methods:
   - create session
   - revoke session
   - rotate session token hash
3. Add audit insert helpers for auth events.

## 4.5 Test Tasks

Tasks:

1. Add unit tests:
   - password hash verify
   - token generation and verification
2. Add integration tests:
   - login success/failure
   - refresh rotation
   - logout revoke
   - `/auth/me` access control
3. Add compatibility test:
   - legacy API key endpoints still functional.

## 5. Acceptance Checklist (Phase 0 + 1)

1. Contract approved by backend + client owner.
2. Schema draft reviewed and migration-safe.
3. Auth endpoints implemented and tested.
4. `req.authContext` available for downstream route integration.
5. Legacy API key compatibility validated.

## 6. Suggested Work Allocation

1. Backend A:
   - schema + repositories + auth service
2. Backend B:
   - routes + middleware + integration tests
3. Client:
   - login screen skeleton + token storage adapter
4. QA:
   - auth regression matrix and compatibility checks

## 7. Daily Sync Template

1. What contract decisions were finalized today?
2. Which endpoint reached “integration-test passing” state?
3. Any migration or compatibility blocker?
4. What can be demoed by end of day?

## ZH

## 1. 目的

把路线图拆成可执行任务，聚焦阶段 0 与阶段 1，支持直接分工开发。

主要参考：

1. [16-server-auth-and-admin-roadmap.md](./16-server-auth-and-admin-roadmap.md)
2. [08-server-api-guide.md](./08-server-api-guide.md)
3. [09-server-deploy-and-database-guide.md](./09-server-deploy-and-database-guide.md)

## 2. 交付时间窗

1. 阶段 0（契约冻结）：2-3 天
2. 阶段 1（认证底座）：4-6 天

## 3. 阶段 0 任务拆解（契约冻结）

## 3.1 角色与权限契约

任务：

1. 定义角色：
   - `super_admin`
   - `tenant_admin`
   - `analyst`
   - `viewer`
2. 定义权限命名空间：
   - `admin:*`
   - `datasource:use:<id>`
   - `template:use:<id>`
3. 定义权限继承矩阵。

交付物：

1. 在路线图文档中补充角色/权限矩阵附录。
2. 在 API 指南中补充认证草案章节。

## 3.2 API 契约草案

任务：

1. 定义以下接口请求/响应结构：
   - `POST /auth/login`
   - `POST /auth/refresh`
   - `POST /auth/logout`
   - `GET /auth/me`
2. 统一错误结构与错误码。
3. 定义旧 API Key 请求兼容行为。

交付物：

1. 带 JSON 示例的契约文档。
2. 错误码表与迁移说明。

## 3.3 数据库结构草案

任务：

1. 输出以下表结构草案：
   - `tenants`
   - `users`
   - `roles`
   - `permissions`
   - `user_roles`
   - `role_permissions`
   - `sessions`
   - `audit_logs`
2. 定义唯一约束与索引。
3. 定义初始角色/权限 seed 策略。

交付物：

1. `match-data-server/schema.sql` 草案更新（或独立 migration 文件）。
2. seed 脚本设计说明。

## 3.4 安全规则冻结

任务：

1. 令牌时效决策：
   - Access token：15-30 分钟
   - Refresh token：7-30 天
2. 密码哈希算法决策：
   - 优先 `argon2id`，备选 `bcrypt`
3. 会话失效与 refresh 轮转规则。

交付物：

1. 安全决策记录文档。

## 4. 阶段 1 任务拆解（认证底座）

## 4.1 服务端代码结构调整

目标目录：

1. `match-data-server/src/routes`
2. `match-data-server/src/middlewares`
3. `match-data-server/src/services`
4. `match-data-server/src/repositories`

新增模块建议：

1. `src/routes/authRoutes.js`
2. `src/middlewares/authenticateUser.js`
3. `src/services/authService.js`
4. `src/repositories/userRepository.js`
5. `src/repositories/sessionRepository.js`

## 4.2 接口实现任务

任务：

1. 实现 `POST /auth/login`
   - 校验账号密码
   - 签发 access + refresh
   - 存储 refresh 会话哈希
2. 实现 `POST /auth/refresh`
   - 校验 refresh token
   - refresh 轮转
   - 返回新 token 对
3. 实现 `POST /auth/logout`
   - 注销当前会话
4. 实现 `GET /auth/me`
   - 返回用户信息 + 角色 + 租户信息

## 4.3 中间件与上下文注入

任务：

1. 实现 JWT 解析与校验中间件。
2. 注入 `req.authContext`：
   - `userId`
   - `tenantId`
   - `roles`
   - `permissions`
3. 增加双模式兼容：
   - 有 JWT -> 新鉴权链路
   - 无 JWT 且 API_KEY 匹配 -> 旧兼容链路

## 4.4 数据访问任务

任务：

1. 用户查询方法：
   - 按登录标识查询用户
   - 查询用户 + 角色 + 权限
2. 会话查询方法：
   - 创建会话
   - 注销会话
   - 轮转会话 token 哈希
3. 增加认证事件审计写入方法。

## 4.5 测试任务

任务：

1. 单元测试：
   - 密码哈希校验
   - token 生成与校验
2. 集成测试：
   - login 成功/失败
   - refresh 轮转
   - logout 注销
   - `/auth/me` 访问控制
3. 兼容测试：
   - 旧 API Key 路径仍可用。

## 5. 阶段 0 + 1 验收清单

1. 契约完成评审并冻结。
2. 数据库草案评审通过，迁移安全。
3. 认证接口实现并通过测试。
4. 下游接口可读取 `req.authContext`。
5. 旧 API Key 兼容通过验证。

## 6. 建议分工

1. 后端 A：
   - schema + repository + auth service
2. 后端 B：
   - route + middleware + 集成测试
3. 客户端：
   - 登录页骨架 + token 存储适配
4. QA：
   - 认证回归矩阵 + 兼容性验证

## 7. 每日同步模板

1. 今天冻结了哪些契约决策？
2. 哪个接口达到“集成测试通过”状态？
3. 是否有迁移或兼容性阻塞？
4. 今天下班前可演示什么？
