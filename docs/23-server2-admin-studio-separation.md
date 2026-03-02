# Server 2.0 Admin Studio Separation / 服务端 2.0 管理端分离说明

## EN

## 1. Decision

Admin Studio 2.0 is a standalone web app colocated with server code, not part of the MatchFlow client app.

## 2. Why

1. Clear ownership:
   - MatchFlow app focuses on end-user analysis experience.
   - Admin Studio focuses on server governance and release operations.
2. Security boundaries:
   - admin capabilities and credentials should not be embedded in client runtime.
3. Independent release:
   - admin web can iterate/deploy without blocking mobile/client releases.

## 3. New Structure

1. Server API and governance runtime:
   - `match-data-server/`
2. Standalone admin web:
   - `match-data-server/admin-studio-web/`
3. Client app:
   - root `src/` no longer includes embedded admin route/page.

## 4. Commands

From `match-data-server`:

```bash
npm run admin-web:dev
npm run admin-web:lint
npm run admin-web:build
```

## 5. Impact

1. Removed from client app:
   - `/admin-studio` route
   - admin entry in home header
   - client-side `AdminStudio` page and admin API service files
2. Migrated to server-owned web project:
   - AdminStudio UI page
   - admin catalog API client
   - admin-only settings storage

---

## ZH

## 1. 决策

Admin Studio 2.0 作为与服务端同仓的独立 Web 应用运行，不再内嵌于 MatchFlow 客户端应用。

## 2. 原因

1. 职责边界清晰：
   - MatchFlow 客户端聚焦终端用户分析体验。
   - Admin Studio 聚焦服务端治理与发布运营。
2. 安全边界清晰：
   - 管理能力与凭据不应进入客户端运行时。
3. 发布节奏独立：
   - 管理端可独立迭代与部署，不阻塞客户端发布。

## 3. 新结构

1. 服务端 API 与治理能力：
   - `match-data-server/`
2. 独立管理端 Web：
   - `match-data-server/admin-studio-web/`
3. 客户端应用：
   - 根目录 `src/` 不再包含内嵌管理端路由/页面。

## 4. 命令

在 `match-data-server` 目录执行：

```bash
npm run admin-web:dev
npm run admin-web:lint
npm run admin-web:build
```

## 5. 影响范围

1. 已从客户端移除：
   - `/admin-studio` 路由
   - 首页管理端入口按钮
   - 客户端 `AdminStudio` 页面和 admin API service 文件
2. 已迁移到服务端所属管理端工程：
   - AdminStudio 页面
   - admin catalog API 客户端
   - 管理端独立设置存储
