# Server Deployment and Database Guide / 服务端部署与数据库指南

## EN

## 1. Deployment Modes

1. Mock mode:
   - No `DATABASE_URL`
   - Fast local smoke tests
2. Database mode:
   - PostgreSQL configured
   - Full admin and extension lifecycle support

## 2. Environment Variables

Required:

1. `PORT` (default `3001`)
2. `API_KEY`

Optional:

1. `DATABASE_URL`
2. `HUB_BASE_URL`
3. `HUB_INCLUDE_API_KEY_HINT`
4. `HUB_API_KEY_HINT`
5. `HUB_AUTO_INSTALL`

## 3. Local Start

```bash
cd match-data-server
npm install
npm run dev
```

## 4. Docker Compose (recommended for DB test)

```bash
cd match-data-server
docker compose up -d
```

Then initialize schema:

```bash
curl -X POST http://127.0.0.1:3001/admin/init \
  -H "Authorization: Bearer <API_KEY>"
```

## 5. Database Schema

Primary tables:

1. `teams`
2. `matches`
3. `extension_manifests`

`extension_manifests` key fields:

1. `kind`
2. `extension_id`
3. `version`
4. `manifest_json`
5. `channel`
6. `status`
7. `checksum`

Key indexes:

1. `idx_extension_manifest_version` (unique on `kind + extension_id + version`)
2. `idx_extension_manifest_lookup`

## 6. Operational Lifecycle

1. Initialize schema (`/admin/init`)
2. Load teams and matches
3. Publish extension manifests
4. Verify hub read endpoints
5. Monitor planner hints and client auto-install behavior

## 7. Security Notes

1. Keep `API_KEY` secret.
2. Use HTTPS in production.
3. Restrict admin endpoint exposure.
4. Add rate limiting and audit logs in production.

## ZH

## 1. 部署模式

1. Mock 模式：
   - 不配置 `DATABASE_URL`
   - 适合本地快速联调
2. 数据库模式：
   - 配置 PostgreSQL
   - 支持完整管理与扩展生命周期

## 2. 环境变量

必填：

1. `PORT`（默认 `3001`）
2. `API_KEY`

可选：

1. `DATABASE_URL`
2. `HUB_BASE_URL`
3. `HUB_INCLUDE_API_KEY_HINT`
4. `HUB_API_KEY_HINT`
5. `HUB_AUTO_INSTALL`

## 3. 本地启动

```bash
cd match-data-server
npm install
npm run dev
```

## 4. Docker Compose（推荐用于数据库验证）

```bash
cd match-data-server
docker compose up -d
```

随后执行 schema 初始化：

```bash
curl -X POST http://127.0.0.1:3001/admin/init \
  -H "Authorization: Bearer <API_KEY>"
```

## 5. 数据库结构

核心表：

1. `teams`
2. `matches`
3. `extension_manifests`

`extension_manifests` 关键字段：

1. `kind`
2. `extension_id`
3. `version`
4. `manifest_json`
5. `channel`
6. `status`
7. `checksum`

关键索引：

1. `idx_extension_manifest_version`（`kind + extension_id + version` 唯一）
2. `idx_extension_manifest_lookup`

## 6. 运维流程

1. 初始化 schema（`/admin/init`）
2. 导入球队与比赛数据
3. 发布扩展 manifest
4. 验证 hub 读取接口
5. 观察规划提示与客户端自动安装行为

## 7. 安全建议

1. 保护 `API_KEY`。
2. 生产环境使用 HTTPS。
3. 限制管理接口暴露范围。
4. 增加限流与审计日志。

