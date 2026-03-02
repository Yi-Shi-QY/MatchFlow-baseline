# MatchFlow Documentation Hub / 文档中心

## EN

## 1. Goal

This folder is the single source of truth for project docs.

The documentation is now organized into three product-facing domains:

1. Client
2. Server
3. Server Web Admin (Admin Studio)

## 2. Entry Points

1. Client docs: [client/README.md](./client/README.md)
2. Server docs: [server/README.md](./server/README.md)
3. Admin Web docs: [admin-web/README.md](./admin-web/README.md)

If you prefer role-based/task-based navigation:

1. [00-role-navigation.md](./00-role-navigation.md)
2. [15-task-navigation.md](./15-task-navigation.md)

## 3. Shared Docs

These docs are cross-domain and should be referenced by all three sections:

1. [01-product-overview.md](./01-product-overview.md)
2. [02-architecture.md](./02-architecture.md)
3. [12-changelog.md](./12-changelog.md)
4. [13-cicd-guide.md](./13-cicd-guide.md)
5. [14-extension-hub-spec.md](./14-extension-hub-spec.md)

## 4. Compatibility Note

Domain documents have been reorganized under `docs/client`, `docs/server`, and `docs/admin-web`.
Legacy root-level duplicate markdown files have been removed. Use domain `README.md` files and
role/task navigation pages as the canonical entry points.

## 5. Writing Rules

1. Every document should include both English and Chinese sections.
2. All markdown files should be UTF-8 encoded.
3. Keep docs operational: include commands, inputs, and expected outputs when relevant.
4. Update docs in the same commit/PR when behavior changes.

## ZH

## 1. 目标

`docs/` 是项目文档唯一可信来源。

文档结构已重构为三大分区：

1. 客户端
2. 服务端
3. 服务端 Web 管理端（Admin Studio）

## 2. 入口

1. 客户端文档入口：[client/README.md](./client/README.md)
2. 服务端文档入口：[server/README.md](./server/README.md)
3. 管理端文档入口：[admin-web/README.md](./admin-web/README.md)

如果按角色或任务查阅：

1. [00-role-navigation.md](./00-role-navigation.md)
2. [15-task-navigation.md](./15-task-navigation.md)

## 3. 公共文档

以下文档是三大分区共享的基础资料：

1. [01-product-overview.md](./01-product-overview.md)
2. [02-architecture.md](./02-architecture.md)
3. [12-changelog.md](./12-changelog.md)
4. [13-cicd-guide.md](./13-cicd-guide.md)
5. [14-extension-hub-spec.md](./14-extension-hub-spec.md)

## 4. 兼容说明

分区文档已归档到 `docs/client`、`docs/server`、`docs/admin-web`。
根目录历史重复文档已清理，请以各分区 `README.md` 与角色/任务导航页作为唯一入口。

## 5. 编写规范

1. 每份文档建议包含中英文双语内容。
2. 文档统一使用 UTF-8 编码。
3. 文档要可执行，尽量包含命令、输入、预期结果。
4. 行为变更时，文档需与代码在同一次提交同步更新。
