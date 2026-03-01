# Changelog / 变更记录

## EN

All notable platform-level changes should be recorded here.

## 2026-03-01

### Added

1. Server-side analysis config endpoints.
2. Hub endpoints with alias compatibility.
3. Extension lifecycle admin endpoints.
4. `extension_manifests` table and related indexes.
5. Unified `docs/` documentation hub with bilingual documents.

### Changed

1. Client now merges server planning hints before analysis start.
2. Match data server refactored into modular routes/services/repositories.
3. Planning and extension contracts documented in unified structure.

### Fixed

1. Mock-mode server startup now tolerates missing local DB dependencies.
2. Documentation structure normalized for maintainability.

## ZH

所有重要功能与架构变更统一记录在本文件中。

## 2026-03-01

### 新增

1. 服务端分析配置接口（`/analysis/config/*`）。
2. Hub 多别名接口兼容路径（`/hub/*` + `/extensions/*`）。
3. 扩展生命周期管理接口（`/admin/extensions*`）。
4. `extension_manifests` 数据表及索引。
5. 统一 `docs/` 双语文档中心。

### 变更

1. 客户端在开始分析前合并服务端规划提示。
2. 数据服务端重构为 routes/services/repositories 分层结构。
3. 规划与扩展契约文档统一到新文档体系。

### 修复

1. mock 模式下服务端可在缺少本地 DB 依赖时启动。
2. 文档分散问题已收敛为单目录管理。

