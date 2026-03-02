# Server 2.0 Kickoff / 服务端 2.0 启动说明

## EN

## 1. Purpose

This document marks the kickoff baseline for Server 2.0 on **2026-03-02** and defines what is already implemented in the first delivery.

## 2. Implemented in Kickoff

1. Added account auth routes:
   - `POST /auth/login`
   - `POST /auth/refresh`
   - `POST /auth/logout`
   - `GET /auth/me`
2. Added capability bootstrap route:
   - `GET /capabilities/me`
3. Upgraded auth middleware to dual mode:
   - Legacy `Authorization: Bearer <API_KEY>` still works for existing clients.
   - New user access token path is enabled in parallel.
4. Added auth foundation modules:
   - `authService`
   - `tokenService`
   - `passwordService`
   - `userRepository`
   - `sessionRepository`
5. Expanded SQL schema with account/RBAC/session/audit tables.
6. Added password hash helper command:
   - `npm run hash-password -- "<password>"`
7. Added authz integration test suite:
   - `npm test` (under `match-data-server`)
8. Added permission enforcement for:
   - `/matches*`
   - `/analysis/config/*`
   - `/hub/*`
9. Added `admin:*` guard for all `/admin/*` routes in account mode.
10. Added admin identity governance APIs:
   - user CRUD + role binding
   - role CRUD + permission binding
   - permission registry and audit log query

## 3. Contract Decisions (Phase 0)

1. Role set:
   - `super_admin`
   - `tenant_admin`
   - `analyst`
   - `viewer`
2. Permission namespace:
   - `admin:*`
   - `datasource:use:*`
   - `template:use:*`
3. Auth migration mode:
   - Keep API key compatibility during rollout.
   - Move clients gradually to account token flow.
4. Token defaults:
   - Access token: `900` seconds
   - Refresh token: `604800` seconds

## 4. Local Bring-Up Checklist

1. Configure `match-data-server/.env` from `.env.example`.
2. Start server:

```bash
cd match-data-server
npm install
npm run dev
```

3. Initialize schema:

```bash
curl -X POST http://localhost:3001/admin/init \
  -H "Authorization: Bearer your-secret-key-here"
```

4. Generate password hash:

```bash
npm run hash-password -- "ChangeMe123!"
```

5. Insert first admin user (example):

```sql
INSERT INTO users (tenant_id, username, email, display_name, password_hash, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'admin@example.com',
  'Platform Admin',
  '<generated-hash>',
  'active'
)
RETURNING id;
```

6. Bind user to `super_admin` role:

```sql
INSERT INTO user_roles (user_id, role_id)
SELECT '<user-id>', id
FROM roles
WHERE code = 'super_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

## 5. Next Steps (After Kickoff)

1. Add integration tests for login/refresh/logout/me.
2. Expand permission model to agent/skill-level scopes (if needed by product policy).
3. Add audit log writes for auth and policy changes.
4. Add admin APIs for users/roles/policies.

## 6. Status Update (as of 2026-03-02)

1. Kickoff scope status: completed.
2. Admin identity APIs status: completed.
3. Web Admin Foundation (Phase B) status: completed.
4. Current stage: Phase C + early Phase D in progress (multi-domain visual builders + publish wizard pre-check gate + validation/release UX enhancements).

## ZH

## 1. 目的

本文定义 **2026-03-02** 的服务端 2.0 启动基线，并说明第一批已经落地的能力。

## 2. 已落地能力

1. 新增账号认证接口：
   - `POST /auth/login`
   - `POST /auth/refresh`
   - `POST /auth/logout`
   - `GET /auth/me`
2. 新增能力下发起点接口：
   - `GET /capabilities/me`
3. 鉴权升级为双模式：
   - 旧客户端继续使用 `Authorization: Bearer <API_KEY>`。
   - 新客户端可并行切换到账号 token。
4. 新增认证基础模块：
   - `authService`
   - `tokenService`
   - `passwordService`
   - `userRepository`
   - `sessionRepository`
5. 扩展数据库 schema，补齐账号、RBAC、会话、审计日志表。
6. 新增密码哈希命令：
   - `npm run hash-password -- "<password>"`
7. 新增鉴权集成测试：
   - 在 `match-data-server` 下执行 `npm test`
8. 已对以下路由启用权限过滤：
   - `/matches*`
   - `/analysis/config/*`
   - `/hub/*`
9. 账号模式下，所有 `/admin/*` 路由已增加 `admin:*` 权限门禁。
10. 已补齐管理治理 API：
   - 用户管理与角色绑定
   - 角色管理与权限绑定
   - 权限清单与审计日志查询

## 3. Phase 0 合同冻结结论

1. 角色集合：
   - `super_admin`
   - `tenant_admin`
   - `analyst`
   - `viewer`
2. 权限命名空间：
   - `admin:*`
   - `datasource:use:*`
   - `template:use:*`
3. 迁移策略：
   - 迁移期保留 API Key 兼容。
   - 客户端分批切换到账号 token。
4. token 默认时效：
   - Access token：`900` 秒
   - Refresh token：`604800` 秒

## 4. 本地启动清单

1. 按 `.env.example` 配置 `match-data-server/.env`。
2. 启动服务：

```bash
cd match-data-server
npm install
npm run dev
```

3. 执行 `/admin/init` 初始化 schema。
4. 通过 `npm run hash-password` 生成密码哈希。
5. 插入首个管理员用户，并绑定 `super_admin` 角色。

## 5. 启动后下一步

1. 补齐 login/refresh/logout/me 集成测试。
2. 按产品策略决定是否补充 agent/skill 级别权限命名空间。
3. 为认证与策略变更写入审计日志。
4. 补齐用户/角色/策略管理 API。
