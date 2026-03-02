# MatchFlow Documentation Hub / 文档中心

This folder is the single source of truth for project documentation.  
本目录是项目文档的唯一入口。

## Start Here / 从这里开始

EN:

1. If you know your role, start with [00-role-navigation.md](./00-role-navigation.md).
2. If you know your task, start with [15-task-navigation.md](./15-task-navigation.md).
3. If you are new, read in order:
   [01-product-overview.md](./01-product-overview.md) ->
   [02-architecture.md](./02-architecture.md) ->
   [03-development.md](./03-development.md).

ZH:

1. 如果你明确角色分工，先看 [00-role-navigation.md](./00-role-navigation.md)。
2. 如果你按任务推进，先看 [15-task-navigation.md](./15-task-navigation.md)。
3. 新成员建议顺序阅读：
   [01-product-overview.md](./01-product-overview.md) ->
   [02-architecture.md](./02-architecture.md) ->
   [03-development.md](./03-development.md)。

## Document Index / 文档索引

1. [00-role-navigation.md](./00-role-navigation.md)  
   Role-based reading paths / 按角色阅读导航
2. [01-product-overview.md](./01-product-overview.md)  
   Product scope, features, and current goals / 产品范围、能力与当前目标
3. [02-architecture.md](./02-architecture.md)  
   Current architecture and runtime boundaries / 当前架构与运行边界
4. [03-development.md](./03-development.md)  
   Development workflows for client/server/admin-web / 客户端、服务端、管理端开发流程
5. [04-ai-agent-framework.md](./04-ai-agent-framework.md)  
   Agent/skill framework and model routing / Agent/Skill 框架与模型路由
6. [05-i18n-and-encoding.md](./05-i18n-and-encoding.md)  
   i18n and UTF-8 quality rules / i18n 与 UTF-8 质量规范
7. [06-agent-skill-extension-guide.md](./06-agent-skill-extension-guide.md)  
   Agent/Skill/Template extension guide / Agent、Skill、Template 扩展指南
8. [07-data-source-extension-guide.md](./07-data-source-extension-guide.md)  
   Declarative data source extension guide / 声明式数据源扩展指南
9. [08-server-api-guide.md](./08-server-api-guide.md)  
   Server API reference / 服务端 API 参考
10. [09-server-deploy-and-database-guide.md](./09-server-deploy-and-database-guide.md)  
    Deployment, database, and operations / 部署、数据库与运维指南
11. [10-server-refactor-roadmap.md](./10-server-refactor-roadmap.md)  
    Server refactor and evolution roadmap / 服务端重构与演进路线
12. [12-changelog.md](./12-changelog.md)  
    Human-readable project changelog / 项目变更记录
13. [13-cicd-guide.md](./13-cicd-guide.md)  
    CI/CD workflow and release strategy / CI/CD 流程与发布策略
14. [14-extension-hub-spec.md](./14-extension-hub-spec.md)  
    Extension manifest schema and compatibility / 扩展 Manifest 规范与兼容性
15. [15-task-navigation.md](./15-task-navigation.md)  
    Task-based reading paths / 按任务定位阅读路径
16. [16-server-auth-and-admin-roadmap.md](./16-server-auth-and-admin-roadmap.md)  
    Auth/account/admin governance roadmap / 账号鉴权与管理治理路线
17. [19-web-admin-studio-upgrade-plan.md](./19-web-admin-studio-upgrade-plan.md)  
    Admin Studio 2.0 upgrade plan / 管理端 2.0 升级计划
18. [20-web-admin-phase-a-contract-freeze.md](./20-web-admin-phase-a-contract-freeze.md)  
    Admin Studio Phase-A contract freeze / 管理端阶段 A 契约冻结
19. [21-server2-phase-e-rollout-runbook.md](./21-server2-phase-e-rollout-runbook.md)  
    Phase-E hardening and rollout runbook / Phase-E 加固与上线手册
20. [22-server2-production-readiness-checklist.md](./22-server2-production-readiness-checklist.md)  
    Production readiness checklist / 生产就绪门禁清单
21. [23-server2-admin-studio-separation.md](./23-server2-admin-studio-separation.md)  
    Admin Studio standalone architecture / 管理端独立架构说明

## Writing Rules / 文档规范

1. Every document must contain English + Chinese sections in the same file.  
   每份文档必须包含中英文双语内容。
2. All docs must be UTF-8 encoded.  
   所有文档必须使用 UTF-8 编码。
3. Keep docs operational, not only conceptual: include commands, inputs, and expected outputs.  
   文档要可执行，不只讲概念，要包含命令、输入与预期结果。
4. When behavior changes, update docs in this folder in the same PR/commit.  
   行为变更时必须在同一提交中同步更新本目录文档。

## Scope / 范围声明

Only markdown files under `docs/` are considered maintained project documentation.  
只有 `docs/` 目录下的 Markdown 文件属于正式维护文档。

## Latest Additions / 最新补充

1. [24-cn-jczq-collection-interface-and-script.md](./24-cn-jczq-collection-interface-and-script.md)  
   CN JCZQ collection API + script runbook / 中国足彩竞彩采集接口与脚本执行手册
