# Web Admin Phase A Contract Freeze / Web 管理端阶段 A 契约冻结

## EN

## 1. Purpose

This document records the Phase A contract-freeze deliverables for the Web Admin Studio upgrade initiated on **2026-03-02**.

It formalizes:

1. API contract draft (OpenAPI)
2. Database migration draft
3. Permission seed and role mapping

## 2. Deliverables

1. OpenAPI draft:
   - `match-data-server/contracts/admin-studio-v1.openapi.yaml`
2. SQL migration draft:
   - `match-data-server/migrations/20260302_admin_studio_phase_a.sql`

## 3. API Contract Highlights

Core endpoint groups:

1. Catalog:
   - `GET /admin/catalog/{domain}`
   - `POST /admin/catalog/{domain}`
   - `GET /admin/catalog/{domain}/{itemId}/revisions`
   - `POST /admin/catalog/{domain}/{itemId}/revisions`
   - `POST /admin/catalog/{domain}/{itemId}/publish`
   - `POST /admin/catalog/{domain}/{itemId}/rollback`
2. Validation:
   - `POST /admin/validate/run`
   - `GET /admin/validate/{runId}`
3. Release:
   - `POST /admin/release/publish`
   - `POST /admin/release/rollback`
   - `GET /admin/release/history`

Domain enum:

1. `datasource`
2. `planning_template`
3. `animation_template`
4. `agent`
5. `skill`

## 4. Database Draft Highlights

Added revision tables:

1. `datasource_revisions`
2. `planning_template_revisions`
3. `animation_template_revisions`
4. `agent_revisions`
5. `skill_revisions`

Added workflow tables:

1. `validation_runs`
2. `release_records`

All tables include:

1. explicit status and channel constraints
2. lookup indexes
3. `updated_at` trigger support

## 5. Permission Contract (Draft)

New permission codes:

1. `catalog:datasource:edit`
2. `catalog:template:edit`
3. `catalog:animation:edit`
4. `catalog:agent:edit`
5. `catalog:skill:edit`
6. `validate:run`
7. `release:publish`
8. `release:rollback`
9. `release:read`
10. `audit:read`

Default role mapping draft:

1. `super_admin`, `tenant_admin`: full set above
2. `analyst`: `validate:run`, `release:read`, `audit:read`

## 6. How to Review and Apply (Draft Flow)

Review contract:

```bash
cd match-data-server
type contracts/admin-studio-v1.openapi.yaml
```

Apply migration in PostgreSQL:

```bash
psql "$DATABASE_URL" -f migrations/20260302_admin_studio_phase_a.sql
```

Alternative (server admin init path):

```bash
curl -X POST http://localhost:3001/admin/init \
  -H "Authorization: Bearer <API_KEY>"
```

This path now applies:

1. `schema.sql`
2. all SQL files under `migrations/` in lexical order

Verify created tables:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'datasource_revisions',
    'planning_template_revisions',
    'animation_template_revisions',
    'agent_revisions',
    'skill_revisions',
    'validation_runs',
    'release_records'
  );
```

## 7. Exit Criteria for Phase A

1. API contract reviewed by backend + web-admin owners.
2. SQL migration reviewed for rollout safety.
3. Permission naming and role mapping approved.
4. Phase B implementation backlog split by API module.

## ZH

## 1. 目的

本文记录 **2026-03-02** 启动的 Web 管理端升级在阶段 A（契约冻结）中的交付物。

冻结内容包括：

1. API 合同草案（OpenAPI）
2. 数据库迁移草案
3. 权限与角色映射草案

## 2. 交付物

1. OpenAPI 草案：
   - `match-data-server/contracts/admin-studio-v1.openapi.yaml`
2. SQL 迁移草案：
   - `match-data-server/migrations/20260302_admin_studio_phase_a.sql`

## 3. API 契约重点

核心接口组：

1. 目录治理（Catalog）
2. 验证运行（Validation）
3. 发布回滚（Release）

域枚举：

1. `datasource`
2. `planning_template`
3. `animation_template`
4. `agent`
5. `skill`

## 4. 数据库草案重点

新增修订表：

1. `datasource_revisions`
2. `planning_template_revisions`
3. `animation_template_revisions`
4. `agent_revisions`
5. `skill_revisions`

新增流程表：

1. `validation_runs`
2. `release_records`

统一约束：

1. 状态与渠道约束
2. 查询索引
3. `updated_at` 自动更新时间触发器

## 5. 权限契约（草案）

新增权限：

1. `catalog:datasource:edit`
2. `catalog:template:edit`
3. `catalog:animation:edit`
4. `catalog:agent:edit`
5. `catalog:skill:edit`
6. `validate:run`
7. `release:publish`
8. `release:rollback`
9. `release:read`
10. `audit:read`

默认角色映射草案：

1. `super_admin`、`tenant_admin`：拥有全部上述权限
2. `analyst`：`validate:run`、`release:read`、`audit:read`

## 6. 评审与应用方式（草案流程）

查看合同：

```bash
cd match-data-server
type contracts/admin-studio-v1.openapi.yaml
```

执行迁移：

```bash
psql "$DATABASE_URL" -f migrations/20260302_admin_studio_phase_a.sql
```

校验建表：

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'datasource_revisions',
    'planning_template_revisions',
    'animation_template_revisions',
    'agent_revisions',
    'skill_revisions',
    'validation_runs',
    'release_records'
  );
```

## 7. 阶段 A 退出标准

1. API 契约经过后端与管理端负责人评审。
2. SQL 迁移通过安全性评审。
3. 权限命名与角色映射冻结。
4. 阶段 B 的 API 开发任务拆分完成。
