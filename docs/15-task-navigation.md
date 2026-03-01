# Task-Based Navigation / 按任务导航

## EN

Use this page when you know **what you want to do**, but not where the docs are.
If you already know your role, see [00-role-navigation.md](./00-role-navigation.md).

## 1. I want to onboard quickly

Read in order:

1. [01-product-overview.md](./01-product-overview.md)
2. [02-architecture.md](./02-architecture.md)
3. [03-development.md](./03-development.md)
4. [00-role-navigation.md](./00-role-navigation.md)

## 2. I want to add a new data source

Read:

1. [07-data-source-extension-guide.md](./07-data-source-extension-guide.md)
2. [02-architecture.md](./02-architecture.md)
3. [05-i18n-and-encoding.md](./05-i18n-and-encoding.md)

Implementation checklist:

1. Add source definition in `src/services/dataSources.ts`.
2. Add source form schema and i18n labels.
3. Validate `sourceContext` fields.
4. Verify planning route changes as expected.

## 3. I want to add or modify an Agent/Skill/Template

Read:

1. [06-agent-skill-extension-guide.md](./06-agent-skill-extension-guide.md)
2. [04-ai-agent-framework.md](./04-ai-agent-framework.md)
3. [14-extension-hub-spec.md](./14-extension-hub-spec.md)

Implementation checklist:

1. Keep IDs stable.
2. Keep output tags and manifest schema valid.
3. Verify runtime fallback behavior.

## 4. I want to integrate server planning recommendations

Read:

1. [08-server-api-guide.md](./08-server-api-guide.md)
2. [10-server-refactor-roadmap.md](./10-server-refactor-roadmap.md)
3. [11-linux-validation-handoff.md](./11-linux-validation-handoff.md)

Implementation checklist:

1. Validate `/analysis/config/*` payload shape.
2. Confirm required extension hints are present.
3. Verify client merge behavior before analysis start.

## 5. I want to deploy or run the server in production-like mode

Read:

1. [09-server-deploy-and-database-guide.md](./09-server-deploy-and-database-guide.md)
2. [08-server-api-guide.md](./08-server-api-guide.md)
3. [13-cicd-guide.md](./13-cicd-guide.md)

Implementation checklist:

1. Configure environment variables.
2. Initialize database and verify schema objects.
3. Run hub/admin endpoint smoke checks.

## 6. I want to validate Linux environment integration

Read:

1. [11-linux-validation-handoff.md](./11-linux-validation-handoff.md)
2. [09-server-deploy-and-database-guide.md](./09-server-deploy-and-database-guide.md)

Implementation checklist:

1. DB connectivity.
2. `/admin/init` success.
3. Extension lifecycle checks.
4. End-to-end auto-install verification from app.

## 7. I want to configure CI/CD and release workflow

Read:

1. [13-cicd-guide.md](./13-cicd-guide.md)
2. [12-changelog.md](./12-changelog.md)

Implementation checklist:

1. Validate CI jobs on PR.
2. Validate CD on `main` and version tags.
3. Confirm release artifact and server image publish behavior.

## ZH

当你明确“要做什么”，但不确定“该看哪篇文档”时，用本页快速定位。
如果你已经明确自己的角色分工，也可以先看 [00-role-navigation.md](./00-role-navigation.md)。

## 1. 我想快速上手项目

按顺序阅读：

1. [01-product-overview.md](./01-product-overview.md)
2. [02-architecture.md](./02-architecture.md)
3. [03-development.md](./03-development.md)
4. [00-role-navigation.md](./00-role-navigation.md)

## 2. 我想新增一个数据源

建议阅读：

1. [07-data-source-extension-guide.md](./07-data-source-extension-guide.md)
2. [02-architecture.md](./02-architecture.md)
3. [05-i18n-and-encoding.md](./05-i18n-and-encoding.md)

实施清单：

1. 在 `src/services/dataSources.ts` 新增数据源定义。
2. 补充表单 schema 和中英文文案。
3. 校验 `sourceContext` 字段完整性。
4. 验证规划路由随能力变化是否符合预期。

## 3. 我想新增或修改 Agent/Skill/Template

建议阅读：

1. [06-agent-skill-extension-guide.md](./06-agent-skill-extension-guide.md)
2. [04-ai-agent-framework.md](./04-ai-agent-framework.md)
3. [14-extension-hub-spec.md](./14-extension-hub-spec.md)

实施清单：

1. 保持 ID 稳定。
2. 保持输出标签和 manifest 契约有效。
3. 验证失败时回退路径可用。

## 4. 我想接入服务端规划推荐

建议阅读：

1. [08-server-api-guide.md](./08-server-api-guide.md)
2. [10-server-refactor-roadmap.md](./10-server-refactor-roadmap.md)
3. [11-linux-validation-handoff.md](./11-linux-validation-handoff.md)

实施清单：

1. 校验 `/analysis/config/*` 返回结构。
2. 确认 required extension 提示字段完整。
3. 验证客户端分析前合并行为。

## 5. 我想部署服务端到生产近似环境

建议阅读：

1. [09-server-deploy-and-database-guide.md](./09-server-deploy-and-database-guide.md)
2. [08-server-api-guide.md](./08-server-api-guide.md)
3. [13-cicd-guide.md](./13-cicd-guide.md)

实施清单：

1. 配置环境变量。
2. 初始化数据库并核对 schema。
3. 对 hub/admin 接口做冒烟验证。

## 6. 我想做 Linux 环境联调验证

建议阅读：

1. [11-linux-validation-handoff.md](./11-linux-validation-handoff.md)
2. [09-server-deploy-and-database-guide.md](./09-server-deploy-and-database-guide.md)

实施清单：

1. 验证数据库连通。
2. 验证 `/admin/init` 成功。
3. 验证扩展生命周期流程。
4. 验证客户端自动安装 e2e。

## 7. 我想配置 CI/CD 与版本发布

建议阅读：

1. [13-cicd-guide.md](./13-cicd-guide.md)
2. [12-changelog.md](./12-changelog.md)

实施清单：

1. 在 PR 上验证 CI 任务。
2. 在 `main` 和 tag 上验证 CD 行为。
3. 核对发布产物和镜像推送结果。
