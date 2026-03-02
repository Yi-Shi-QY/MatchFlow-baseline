# Architecture / 架构说明

## EN

## 1. System Context

MatchFlow is now split into three independent but connected runtimes:

1. Client App (`/src`, React + Capacitor):
   - end-user match analysis experience
   - no embedded admin/governance UI
2. Server 2.0 (`/match-data-server`, Node.js + Express + PostgreSQL):
   - data collection, governance, validation, release, distribution
   - auth, permission, catalog, release, audit
3. Admin Studio Web (`/match-data-server/admin-studio-web`, standalone React + Vite app):
   - server governance console and design tool
   - visual editing for datasource/planning/animation/agent/skill

## 2. Repository Layout (Current)

```text
/
|- src/                                 # MatchFlow client app
|- match-data-server/                   # Server 2.0
|  |- src/routes                        # auth, match, analysis, hub, admin APIs
|  |- src/services                      # auth/catalog/validation/release business logic
|  |- src/repositories                  # persistence layer (DB-backed)
|  |- test/                             # integration and phase-gate test suites
|  |- admin-studio-web/                 # standalone admin web app
|- docs/                                # canonical project documentation
```

## 3. Runtime Responsibilities

## 3.1 Client App

1. Reads match list and match details.
2. Builds analysis payload and `sourceContext`.
3. Calls server planning/config endpoints.
4. Streams analysis output and renders UI incrementally.
5. Uses user-facing extension/runtime features only.

## 3.2 Server 2.0

1. AuthN/AuthZ:
   - access token + refresh token
   - role/permission enforcement
2. Data + governance APIs:
   - `/matches*`
   - `/analysis/config/*`
   - `/hub/*`
   - `/admin/catalog/*`
   - `/admin/validate/*`
   - `/admin/release/*`
3. Validation + release:
   - strict manifest checks
   - publish/rollback gates
4. Operational controls:
   - `/livez`, `/readyz`, `/health`
   - graceful shutdown
   - audit records

## 3.3 Admin Studio Web (Standalone)

1. Uses server admin APIs only.
2. Provides visual governance workflow:
   - create/edit draft
   - create revision + diff
   - run validation
   - publish/rollback
   - release history lookup
3. Stores only admin-web local connection settings:
   - server URL
   - API key (or future auth token path)

## 4. Core Data Flow

1. Governance authoring flow:
   - Admin Studio Web -> `/admin/catalog/*`
   - Admin Studio Web -> `/admin/validate/run`
   - Admin Studio Web -> `/admin/catalog/:domain/:itemId/publish|rollback`
2. Runtime distribution flow:
   - Client App -> Server planning/config/hub APIs
   - Server resolves policy + latest published artifacts
3. Traceability flow:
   - validation run -> release record -> audit log linkage

## 5. Deployment Topology (Recommended)

1. Client App:
   - distributed as mobile/web client
2. Server API:
   - containerized service with PostgreSQL
3. Admin Studio Web:
   - independent static deployment
   - can be hosted behind same auth domain as server admin APIs

## 6. Architecture Constraints

1. Admin Studio must remain independent from client app runtime.
2. Server is final authority for validation/publish policy.
3. No publish without successful validation gate.
4. All write operations must be auditable.

## ZH

## 1. 系统边界

MatchFlow 当前已拆分为三个相互协作、独立运行的运行时：

1. 客户端 App（`/src`，React + Capacitor）：
   - 面向终端用户的比赛分析体验
   - 不再内嵌管理治理端
2. 服务端 2.0（`/match-data-server`，Node.js + Express + PostgreSQL）：
   - 数据采集、治理、验证、发布、分发
   - 认证鉴权、目录管理、发布与审计
3. Admin Studio Web（`/match-data-server/admin-studio-web`，独立 React + Vite）：
   - 服务端治理后台与设计器
   - 可视化编辑 datasource/planning/animation/agent/skill

## 2. 当前仓库结构

```text
/
|- src/                                 # MatchFlow 客户端应用
|- match-data-server/                   # 服务端 2.0
|  |- src/routes                        # auth、match、analysis、hub、admin API
|  |- src/services                      # auth/catalog/validation/release 业务逻辑
|  |- src/repositories                  # 持久层（DB）
|  |- test/                             # 集成与阶段门禁测试
|  |- admin-studio-web/                 # 独立管理端 Web 应用
|- docs/                                # 项目文档中心
```

## 3. 运行时职责

## 3.1 客户端 App

1. 获取比赛列表和比赛详情。
2. 组装分析请求与 `sourceContext`。
3. 调用服务端规划/配置接口。
4. 处理流式分析结果并增量渲染。
5. 仅使用用户侧功能，不包含治理写操作。

## 3.2 服务端 2.0

1. 认证与权限：
   - access token + refresh token
   - 角色权限强制校验
2. 数据与治理 API：
   - `/matches*`
   - `/analysis/config/*`
   - `/hub/*`
   - `/admin/catalog/*`
   - `/admin/validate/*`
   - `/admin/release/*`
3. 验证与发布：
   - 严格 manifest 校验
   - 发布/回滚门禁
4. 运维能力：
   - `/livez`、`/readyz`、`/health`
   - 优雅停机
   - 审计记录

## 3.3 Admin Studio Web（独立）

1. 仅调用服务端 Admin API。
2. 提供可视化治理闭环：
   - 草稿编辑
   - 版本创建与 diff
   - 运行验证
   - 发布/回滚
   - 发布历史检索
3. 仅持久化管理端连接配置：
   - server URL
   - API key（后续可替换为账号 token）

## 4. 核心数据流

1. 治理设计流：
   - Admin Studio Web -> `/admin/catalog/*`
   - Admin Studio Web -> `/admin/validate/run`
   - Admin Studio Web -> `/admin/catalog/:domain/:itemId/publish|rollback`
2. 运行时分发流：
   - Client App -> 服务端规划/配置/Hub API
   - 服务端按权限与已发布版本分发能力
3. 可追踪流：
   - validation run -> release record -> audit log

## 5. 推荐部署拓扑

1. 客户端 App：
   - 作为移动端/网页端分发
2. 服务端 API：
   - 容器化运行，配套 PostgreSQL
3. Admin Studio Web：
   - 独立静态部署
   - 建议与服务端管理 API 位于同一受控安全域

## 6. 架构约束

1. Admin Studio 必须保持与客户端运行时解耦。
2. 发布策略以服务端校验结果为最终权威。
3. 无成功验证结果不得发布。
4. 所有治理写操作必须可审计。
