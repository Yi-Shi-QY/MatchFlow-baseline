# Architecture / 架构说明

## EN

## 1. Repository Layout

```text
/
|- src/                       # App source (React + Capacitor runtime logic)
|  |- agents/                 # Agent registry and prompts
|  |- skills/                 # Local deterministic tools
|  |- services/               # AI, storage, data-source orchestration
|  |- pages/                  # Home, MatchDetail, Settings, etc.
|  |- contexts/               # Analysis lifecycle state
|  |- docs/                   # Legacy doc entry points (migrated to /docs)
|- match-data-server/         # Optional backend service
|  |- src/routes              # API route modules
|  |- src/services            # Planning and manifest business logic
|  |- src/repositories        # DB/mock persistence logic
|  |- schema.sql              # PostgreSQL schema
|- docs/                      # Canonical documentation hub
```

## 2. Runtime Flow (App)

1. `MatchDetail` builds editable analysis payload.
2. Selected data sources produce `sourceContext`.
3. Before analysis start, app fetches server planning config and merges into payload.
4. `AnalysisContext.startAnalysis` starts stream pipeline.
5. `streamAgentThoughts` executes:
   - Plan generation.
   - Per-segment agent execution.
   - Optional animation extraction and validation.
   - Tag extraction.
   - Final summary generation.
6. Parser reads tagged stream blocks and UI renders incremental output.

## 3. Source -> Planning -> Agent Boundaries

1. Source layer:
   - Declarative source definitions in `src/services/dataSources.ts`.
2. Planning layer:
   - Route decided from settings + `sourceContext` + optional forced planning.
3. Agent layer:
   - Agent type selected per segment.
   - Context dependency applied (`none`, `all`, or explicit list).
4. Skill layer:
   - Tool calls are deterministic and locally executed.

## 4. Model Routing

1. `global` mode: one provider/model for all agents.
2. `config` mode: per-agent provider/model from config map.
3. Providers:
   - Gemini
   - DeepSeek (V3 / R1)
   - OpenAI-compatible endpoints
4. Tool-call compatibility fallback:
   - Native tool calls first.
   - Manual protocol fallback when model endpoint rejects tool calls.

## 5. Server Architecture

1. Route modules:
   - match routes
   - analysis config routes
   - hub routes
   - admin routes
2. Services:
   - planning recommendation service
   - hub manifest service
3. Repositories:
   - match repository (DB + mock fallback)
   - extension repository (versioned manifests)

## 6. Maintainability Priorities

1. Keep `MatchDetail` and `ai` orchestration logic modular.
2. Keep extension schema strictly validated.
3. Keep docs and runtime contracts synchronized.
4. Add more contract tests for planning decisions and manifest loading.

## ZH

## 1. 仓库结构

```text
/
|- src/                       # 前端主应用代码（React + Capacitor）
|  |- agents/                 # Agent 注册与提示词
|  |- skills/                 # 本地确定性工具
|  |- services/               # AI、存储、数据源编排
|  |- pages/                  # Home、MatchDetail、Settings 等页面
|  |- contexts/               # 分析生命周期状态
|  |- docs/                   # 旧文档入口（已迁移到 /docs）
|- match-data-server/         # 可选服务端
|  |- src/routes              # API 路由模块
|  |- src/services            # 规划与扩展清单业务逻辑
|  |- src/repositories        # DB/Mock 数据持久层
|  |- schema.sql              # PostgreSQL 表结构
|- docs/                      # 当前唯一文档中心
```

## 2. 应用运行流程

1. `MatchDetail` 组装可编辑分析数据。
2. 根据数据源选择生成 `sourceContext`。
3. 开始分析前请求服务端规划配置并合并到 payload。
4. `AnalysisContext.startAnalysis` 启动流式分析。
5. `streamAgentThoughts` 执行：
   - 生成计划。
   - 按分段调用不同 Agent。
   - 可选动画参数提取与校验。
   - 标签提取。
   - 最终总结。
6. 解析器持续解析结构化标签，UI 增量渲染。

## 3. 数据源 -> 规划 -> Agent 边界

1. 数据源层：
   - `src/services/dataSources.ts` 声明式定义。
2. 规划层：
   - 由设置、`sourceContext` 和强制配置共同决定路由。
3. Agent 层：
   - 每个 segment 指定 `agentType`。
   - 应用上下文依赖策略（`none`、`all` 或指定依赖）。
4. Skill 层：
   - 工具调用本地执行，确保可控与可复现。

## 4. 模型路由

1. `global`：所有 Agent 使用同一 provider/model。
2. `config`：每个 Agent 使用独立 provider/model 配置。
3. 支持提供方：
   - Gemini
   - DeepSeek（V3 / R1）
   - OpenAI 兼容接口
4. 工具调用兼容回退：
   - 优先原生 tool call。
   - 不支持时回退手动协议。

## 5. 服务端架构

1. 路由模块：
   - 比赛查询路由
   - 分析配置路由
   - Hub 路由
   - Admin 路由
2. 服务层：
   - 规划推荐服务
   - Manifest 服务
3. 仓储层：
   - Match 仓储（DB + Mock）
   - Extension 仓储（版本化 Manifest）

## 6. 可维护性重点

1. 持续拆分 `MatchDetail` 与 AI 编排代码。
2. 严格执行扩展清单校验。
3. 文档与运行时契约同步更新。
4. 增强规划决策与 Manifest 加载的契约测试。

