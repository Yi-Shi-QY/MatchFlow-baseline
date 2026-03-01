# MatchFlow Documentation Hub / 文档中心

This folder is the **single source of truth** for project documentation.  
本目录是项目文档的**唯一标准入口**。

## Document Index / 文档索引

1. [00-role-navigation.md](./00-role-navigation.md)  
   Role-based reading paths / 按角色阅读路径
2. [01-product-overview.md](./01-product-overview.md)  
   Product scope, features, current goals / 产品范围、能力与当前目标
3. [02-architecture.md](./02-architecture.md)  
   App/server architecture and runtime flow / 前后端架构与运行流程
4. [03-development.md](./03-development.md)  
   Local development and release workflow / 本地开发与发布流程
5. [04-ai-agent-framework.md](./04-ai-agent-framework.md)  
   Agent/skill pipeline and model routing / Agent-Skill 流程与模型路由
6. [05-i18n-and-encoding.md](./05-i18n-and-encoding.md)  
   i18n and UTF-8 quality rules / i18n 与 UTF-8 质量规范
7. [06-agent-skill-extension-guide.md](./06-agent-skill-extension-guide.md)  
   Agent/Skill/Template extension guide / Agent、Skill、Template 扩展指南
8. [07-data-source-extension-guide.md](./07-data-source-extension-guide.md)  
   Declarative data source extension guide / 声明式数据源扩展指南
9. [08-server-api-guide.md](./08-server-api-guide.md)  
   Match data server API reference / 数据服务端 API 参考
10. [09-server-deploy-and-database-guide.md](./09-server-deploy-and-database-guide.md)  
   Deployment, PostgreSQL schema, admin workflows / 部署、数据库与运维流程
11. [10-server-refactor-roadmap.md](./10-server-refactor-roadmap.md)  
    Server evolution roadmap / 服务端重构与演进路线
12. [11-linux-validation-handoff.md](./11-linux-validation-handoff.md)  
    Linux environment validation checklist / Linux 环境联调校验清单
13. [12-changelog.md](./12-changelog.md)  
    Human-readable project change log / 项目变更记录
14. [13-cicd-guide.md](./13-cicd-guide.md)  
    CI/CD workflow and release strategy / CI/CD 工作流与发布策略
15. [14-extension-hub-spec.md](./14-extension-hub-spec.md)  
    Manifest schema and hub compatibility / Manifest 结构与 Hub 兼容规范

## Writing Rules / 文档规范

1. Every document must contain English + Chinese sections in the same file.  
   每份文档必须在同一文件内同时包含英文和中文。
2. All docs must be UTF-8 encoded.  
   所有文档必须为 UTF-8 编码。
3. Keep docs operational, not only conceptual: include commands, inputs, and expected outputs.  
   文档必须可操作，不仅讲概念，还要给命令、输入和预期结果。
4. When behavior changes, update docs in this folder in the same PR/commit.  
   功能行为变化时，必须在同一 PR/提交中同步更新本目录文档。

## Scope / 范围声明

Only markdown files under `docs/` are considered maintained project documentation.  
仅 `docs/` 目录内的 Markdown 文件属于正式维护文档。
