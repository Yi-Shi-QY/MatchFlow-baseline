# Server Refactor Roadmap / 服务端重构路线

## EN

## 1. Completed (as of 2026-03-01)

1. Modularized server from single-file to layered modules.
2. Added analysis config APIs.
3. Added hub manifest API aliases for client fallback behavior.
4. Added extension admin lifecycle APIs.
5. Added `extension_manifests` schema and indexes.
6. Added mock-mode startup fallback when DB dependencies are not available.

## 2. Current Gaps

1. No signature verification for manifests yet.
2. No ETag/cache layer for hub endpoints yet.
3. No dedicated `analysis_profiles` table and management yet.
4. Contract tests are still limited.

## 3. Next Phases

## Phase A: Contract Hardening

1. Add request/response schema validation.
2. Add consistent error code structure.
3. Add API contract tests for:
   - `/analysis/config/*`
   - `/hub/*`
   - `/admin/extensions/*`

## Phase B: Data and Release Control

1. Add profile-driven planning overrides (`analysis_profiles`).
2. Add staged rollout by channel.
3. Add stronger publish/rollback workflow.

## Phase C: Runtime Robustness

1. Add cache and ETag for hub manifests.
2. Add observability metrics and tracing.
3. Add operational dashboards for planning and install failures.

## 4. Definition of Done for Next Milestone

1. DB-backed extension lifecycle fully verified in Linux environment.
2. Client auto-install e2e path validated with clean local extension store.
3. Contract tests run in CI.
4. Docs remain synchronized with endpoint behavior.

## ZH

## 1. 已完成（截至 2026-03-01）

1. 服务端由单文件拆分为分层模块。
2. 新增分析配置接口。
3. 新增 Hub 多别名路径，兼容客户端回退策略。
4. 新增扩展生命周期管理接口。
5. 新增 `extension_manifests` 表及索引。
6. 增加无 DB 依赖时的 mock 启动回退能力。

## 2. 当前缺口

1. Manifest 签名校验尚未接入。
2. Hub 接口尚未做 ETag/缓存层。
3. 尚未引入 `analysis_profiles` 表和管理能力。
4. 契约测试覆盖还不足。

## 3. 下一阶段

## 阶段 A：契约加固

1. 增加请求/响应 schema 校验。
2. 统一错误码与错误结构。
3. 补齐以下接口契约测试：
   - `/analysis/config/*`
   - `/hub/*`
   - `/admin/extensions/*`

## 阶段 B：数据与发布控制

1. 增加 profile 驱动的规划覆盖规则（`analysis_profiles`）。
2. 增加按 channel 的分阶段发布。
3. 增强发布/回滚流程。

## 阶段 C：运行时稳健性

1. 增加 Hub manifest 的缓存与 ETag。
2. 增加指标与链路追踪。
3. 建立规划和自动安装失败的运维看板。

## 4. 下一里程碑完成标准

1. Linux 环境下完成 DB 生命周期验证。
2. 在干净扩展仓状态下完成客户端自动安装 e2e 验证。
3. CI 可运行契约测试。
4. 文档与实际接口行为保持同步。

