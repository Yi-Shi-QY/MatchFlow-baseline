# Development Guide / 开发指南

## EN

## 1. Prerequisites

1. Node.js 18+
2. npm
3. Docker (recommended for local PostgreSQL and server validation)
4. Android Studio / Xcode (only when developing mobile runtime)

## 2. Workspaces

This repository now has three active workspaces:

1. Client App:
   - root `package.json`
   - source in `/src`
2. Server 2.0:
   - `/match-data-server`
3. Standalone Admin Studio Web:
   - `/match-data-server/admin-studio-web`

## 3. Client App (End-User Runtime)

```bash
npm install
npm run dev
npm run lint
npm run build
```

Notes:

1. Client app no longer contains embedded admin studio route/page.
2. Keep client focused on match analysis user flows.

## 4. Server 2.0

```bash
cd match-data-server
npm install
npm run dev
```

Useful commands:

1. `npm test`
2. `npm run test:db-phase`
3. `npm run test:phase-e`
4. `npm run test:joint-smoke`
5. `npm run test:web-joint-smoke`
6. `npm run test:prod-ready`
7. `npm run preflight:prod`

Database lifecycle:

1. `npm run db:up`
2. `npm run db:logs`
3. `npm run db:down`

## 5. Admin Studio Web (Standalone)

From server root:

```bash
cd match-data-server
npm run admin-web:dev
npm run admin-web:lint
npm run admin-web:build
npm run admin-web:e2e
```

Directly from admin web folder:

```bash
cd match-data-server/admin-studio-web
npm install
npm run dev
npm run test:e2e
```

Optional env defaults:

1. `VITE_MATCH_DATA_SERVER_URL`
2. `VITE_MATCH_DATA_API_KEY`
3. `E2E_MATCH_DATA_SERVER_URL`
4. `E2E_MATCH_DATA_API_KEY`

## 6. Production Gate Sequence (Server 2.0)

```bash
cd match-data-server
npm test
npm run test:db-phase
npm run test:phase-e
npm run test:joint-smoke
npm run test:web-joint-smoke
npm run test:prod-ready
npm run preflight:prod
```

If local DB has no SSL:

```bash
DB_SSL_MODE=disable npm run preflight:prod
```

## 7. Commit Rules

1. Keep code and docs changes in the same commit/PR.
2. Run lint/tests for affected workspace before commit.
3. When server contracts change, update docs under `docs/` in the same change set.

## ZH

## 1. 前置环境

1. Node.js 18+
2. npm
3. Docker（建议用于本地 PostgreSQL 与服务端联调）
4. Android Studio / Xcode（仅在开发移动端运行时时需要）

## 2. 工作区划分

当前仓库有三个活跃工作区：

1. 客户端 App：
   - 根目录 `package.json`
   - 源码在 `/src`
2. 服务端 2.0：
   - `/match-data-server`
3. 独立 Admin Studio Web：
   - `/match-data-server/admin-studio-web`

## 3. 客户端 App（终端用户运行时）

```bash
npm install
npm run dev
npm run lint
npm run build
```

说明：

1. 客户端已不再包含内嵌 admin studio 路由/页面。
2. 客户端应聚焦比赛分析用户流程。

## 4. 服务端 2.0

```bash
cd match-data-server
npm install
npm run dev
```

常用命令：

1. `npm test`
2. `npm run test:db-phase`
3. `npm run test:phase-e`
4. `npm run test:joint-smoke`
5. `npm run test:web-joint-smoke`
6. `npm run test:prod-ready`
7. `npm run preflight:prod`

数据库生命周期：

1. `npm run db:up`
2. `npm run db:logs`
3. `npm run db:down`

## 5. Admin Studio Web（独立管理端）

在服务端目录执行：

```bash
cd match-data-server
npm run admin-web:dev
npm run admin-web:lint
npm run admin-web:build
```

直接在 admin web 目录执行：

```bash
cd match-data-server/admin-studio-web
npm install
npm run dev
```

可选默认环境变量：

1. `VITE_MATCH_DATA_SERVER_URL`
2. `VITE_MATCH_DATA_API_KEY`

## 6. 服务端生产门禁顺序

```bash
cd match-data-server
npm test
npm run test:db-phase
npm run test:phase-e
npm run test:joint-smoke
npm run test:web-joint-smoke
npm run test:prod-ready
npm run preflight:prod
```

若本地数据库未启用 SSL：

```bash
DB_SSL_MODE=disable npm run preflight:prod
```

## 7. 提交规则

1. 代码与文档同一提交/PR 同步更新。
2. 提交前执行受影响工作区的 lint/测试。
3. 服务端契约变更时，必须在同一改动中同步更新 `docs/`。
