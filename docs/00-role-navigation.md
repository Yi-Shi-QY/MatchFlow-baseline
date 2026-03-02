# Role-Based Navigation / 按读者角色导航

## EN

If you prefer task-first lookup, also see [15-task-navigation.md](./15-task-navigation.md).
If you prefer domain-first lookup, see:
1. [client/README.md](./client/README.md)
2. [server/README.md](./server/README.md)
3. [admin-web/README.md](./admin-web/README.md)

### Quick Paths

1. 30-minute quick context:
   [01-product-overview.md](./01-product-overview.md) ->
   [02-architecture.md](./02-architecture.md) ->
   [12-changelog.md](./12-changelog.md).
2. Half-day full onboarding:
   [01-product-overview.md](./01-product-overview.md) ->
   [02-architecture.md](./02-architecture.md) ->
   [03-development.md](./client/03-development.md) ->
   [00-role-navigation.md](./00-role-navigation.md).

## 1. Product Owner / PM

Start here:

1. [01-product-overview.md](./01-product-overview.md)
2. [02-architecture.md](./02-architecture.md)
3. [12-changelog.md](./12-changelog.md)

Focus:

1. Product scope and roadmap.
2. Major architecture decisions and tradeoffs.
3. Release-visible changes.

## 2. Frontend Engineer

Start here:

1. [02-architecture.md](./02-architecture.md)
2. [03-development.md](./client/03-development.md)
3. [07-data-source-extension-guide.md](./client/07-data-source-extension-guide.md)
4. [05-i18n-and-encoding.md](./client/05-i18n-and-encoding.md)

Focus:

1. `MatchDetail` data flow and `sourceContext`.
2. Streaming analysis lifecycle and UI behaviors.
3. i18n and UTF-8 quality controls.

## 3. AI / Agent Engineer

Start here:

1. [04-ai-agent-framework.md](./client/04-ai-agent-framework.md)
2. [06-agent-skill-extension-guide.md](./client/06-agent-skill-extension-guide.md)
3. [14-extension-hub-spec.md](./14-extension-hub-spec.md)

Focus:

1. Agent contract and output tag stability.
2. Skill runtime safety model.
3. Manifest compatibility and auto-install behavior.

## 4. Backend Engineer

Start here:

1. [08-server-api-guide.md](./server/08-server-api-guide.md)
2. [09-server-deploy-and-database-guide.md](./server/09-server-deploy-and-database-guide.md)
3. [10-server-refactor-roadmap.md](./server/10-server-refactor-roadmap.md)
4. [14-extension-hub-spec.md](./14-extension-hub-spec.md)

Focus:

1. API contracts and compatibility constraints.
2. DB schema, extension lifecycle, and hub endpoints.
3. Server refactor priorities and next phases.

## 5. QA / Integration Engineer

Start here:

1. [08-server-api-guide.md](./server/08-server-api-guide.md)
2. [22-server2-production-readiness-checklist.md](./server/22-server2-production-readiness-checklist.md)
3. [13-cicd-guide.md](./13-cicd-guide.md)

Focus:

1. Endpoint contract and auth checks.
2. Production readiness gate checklist.
3. CI/CD execution signals and release artifacts.

## 6. DevOps / Release Engineer

Start here:

1. [09-server-deploy-and-database-guide.md](./server/09-server-deploy-and-database-guide.md)
2. [13-cicd-guide.md](./13-cicd-guide.md)
3. [12-changelog.md](./12-changelog.md)

Focus:

1. Deployment environments and runtime variables.
2. Pipeline behavior and release controls.
3. Version tags and release deliverables.

## 7. New Team Member (Fast Onboarding Path)

Suggested reading order:

1. [01-product-overview.md](./01-product-overview.md)
2. [02-architecture.md](./02-architecture.md)
3. [03-development.md](./client/03-development.md)
4. Your role-specific section in this file.

## ZH

如果你希望按系统分区阅读，可直接从以下入口开始：
1. [client/README.md](./client/README.md)
2. [server/README.md](./server/README.md)
3. [admin-web/README.md](./admin-web/README.md)


如果你更习惯按任务查阅，也可以先看 [15-task-navigation.md](./15-task-navigation.md)。

### 快速路径

1. 30 分钟快速了解：
   [01-product-overview.md](./01-product-overview.md) ->
   [02-architecture.md](./02-architecture.md) ->
   [12-changelog.md](./12-changelog.md)。
2. 半天完整上手：
   [01-product-overview.md](./01-product-overview.md) ->
   [02-architecture.md](./02-architecture.md) ->
   [03-development.md](./client/03-development.md) ->
   [00-role-navigation.md](./00-role-navigation.md)。

## 1. 产品 / 项目负责人

建议先读：

1. [01-product-overview.md](./01-product-overview.md)
2. [02-architecture.md](./02-architecture.md)
3. [12-changelog.md](./12-changelog.md)

关注重点：

1. 产品范围与路线。
2. 架构关键决策。
3. 发布可见变化。

## 2. 前端工程师

建议先读：

1. [02-architecture.md](./02-architecture.md)
2. [03-development.md](./client/03-development.md)
3. [07-data-source-extension-guide.md](./client/07-data-source-extension-guide.md)
4. [05-i18n-and-encoding.md](./client/05-i18n-and-encoding.md)

关注重点：

1. `MatchDetail` 和 `sourceContext` 数据流。
2. 流式分析生命周期与 UI 行为。
3. i18n 与 UTF-8 质量控制。

## 3. AI / Agent 工程师

建议先读：

1. [04-ai-agent-framework.md](./client/04-ai-agent-framework.md)
2. [06-agent-skill-extension-guide.md](./client/06-agent-skill-extension-guide.md)
3. [14-extension-hub-spec.md](./14-extension-hub-spec.md)

关注重点：

1. Agent 契约与输出标签稳定性。
2. Skill 运行安全模型。
3. Manifest 兼容性与自动安装行为。

## 4. 后端工程师

建议先读：

1. [08-server-api-guide.md](./server/08-server-api-guide.md)
2. [09-server-deploy-and-database-guide.md](./server/09-server-deploy-and-database-guide.md)
3. [10-server-refactor-roadmap.md](./server/10-server-refactor-roadmap.md)
4. [14-extension-hub-spec.md](./14-extension-hub-spec.md)

关注重点：

1. API 契约与兼容约束。
2. 数据库结构和扩展生命周期。
3. Hub 接口和后续重构重点。

## 5. 测试 / 集成工程师

建议先读：

1. [08-server-api-guide.md](./server/08-server-api-guide.md)
2. [22-server2-production-readiness-checklist.md](./server/22-server2-production-readiness-checklist.md)
3. [13-cicd-guide.md](./13-cicd-guide.md)

关注重点：

1. 接口契约和鉴权校验。
2. Linux 环境验证清单。
3. CI/CD 信号与发布产物检查。

## 6. 运维 / 发布工程师

建议先读：

1. [09-server-deploy-and-database-guide.md](./server/09-server-deploy-and-database-guide.md)
2. [13-cicd-guide.md](./13-cicd-guide.md)
3. [12-changelog.md](./12-changelog.md)

关注重点：

1. 部署环境和运行变量。
2. 流水线行为与发布控制。
3. 版本 tag 与交付产物。

## 7. 新成员快速上手路径

推荐阅读顺序：

1. [01-product-overview.md](./01-product-overview.md)
2. [02-architecture.md](./02-architecture.md)
3. [03-development.md](./client/03-development.md)
4. 再进入本文对应角色章节。
