# Linux Validation Handoff / Linux 环境验证交接

## EN

## 1. Purpose

This checklist is used when moving from Windows local development to Linux-based integration validation.

## 2. What Has Already Been Verified

1. Mock-mode server startup.
2. Match read APIs.
3. Analysis config APIs.
4. Hub endpoint fallback path compatibility.
5. Planning hints include required agents/skills + hub hints.

## 3. What Must Be Verified on Linux

1. PostgreSQL connectivity.
2. `/admin/init` schema creation.
3. Presence of extension table/index/trigger:
   - `extension_manifests`
   - `idx_extension_manifest_version`
   - `idx_extension_manifest_lookup`
   - `update_extension_manifests_modtime`
4. Extension admin lifecycle:
   - create
   - update
   - publish
   - hub readback
5. Client auto-install full path with missing extensions.

## 4. Linux Execution Checklist

1. Configure env in `match-data-server/.env`:
   - `PORT`
   - `API_KEY`
   - `DATABASE_URL`
2. Start DB and server.
3. Run:
   - `/health`
   - `/admin/init`
   - `/matches`
   - `/analysis/config/match/:id`
   - `/hub/templates/live_market_pro`
4. Verify SQL objects in PostgreSQL.
5. Run one end-to-end analysis from app client with clean extension store.

## 5. Suggested Commands

```bash
cd match-data-server
npm install
npm run dev

curl -s http://127.0.0.1:3001/health
curl -s -X POST http://127.0.0.1:3001/admin/init -H "Authorization: Bearer ${API_KEY}"
```

## ZH

## 1. 目的

该清单用于从 Windows 本地开发切换到 Linux 环境进行完整联调验证。

## 2. 已完成验证内容

1. mock 模式服务端可启动。
2. 赛事读取 API 可用。
3. 分析配置接口可用。
4. Hub 回退路径兼容性通过。
5. 规划提示中包含 required agents/skills 与 hub 信息。

## 3. Linux 必须补齐的验证

1. PostgreSQL 连接可用。
2. `/admin/init` 成功建表。
3. 扩展相关表/索引/触发器存在：
   - `extension_manifests`
   - `idx_extension_manifest_version`
   - `idx_extension_manifest_lookup`
   - `update_extension_manifests_modtime`
4. 扩展管理生命周期验证：
   - 创建
   - 更新
   - 发布
   - Hub 回读
5. 客户端缺失扩展自动安装全链路验证。

## 4. Linux 执行清单

1. 配置 `match-data-server/.env`：
   - `PORT`
   - `API_KEY`
   - `DATABASE_URL`
2. 启动数据库与服务端。
3. 依次验证：
   - `/health`
   - `/admin/init`
   - `/matches`
   - `/analysis/config/match/:id`
   - `/hub/templates/live_market_pro`
4. 在 PostgreSQL 中确认对象存在。
5. 清空本地扩展后从客户端跑一条完整分析链路。

## 5. 推荐命令

```bash
cd match-data-server
npm install
npm run dev

curl -s http://127.0.0.1:3001/health
curl -s -X POST http://127.0.0.1:3001/admin/init -H "Authorization: Bearer ${API_KEY}"
```

