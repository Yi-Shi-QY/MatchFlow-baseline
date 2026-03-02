# 25. Project Goals and Introduction / 项目目标与介绍

## EN

## 1. Project Introduction

### 1.1 What MatchFlow Is

MatchFlow is a mobile-first AI analysis application that turns raw, heterogeneous data into structured, explainable insights.

As of **March 2, 2026**, MatchFlow is evolving from a football-centric analysis app into a **domain-pack-driven general analysis platform**:

1. Users connect to different data-source backends.
2. The client discovers and installs domain-specific capabilities.
3. Analysis is executed through reusable agents, skills, templates, and animation blocks.

### 1.2 The Problem We Solve

Most analysis workflows fail on one or more of these dimensions:

1. Data is fragmented and inconsistent across sources.
2. Insights are hard to reproduce or audit.
3. Expert workflows are locked in custom code, not reusable components.
4. Mobile experience is weak for serious analysis tasks.

MatchFlow addresses this with a composable runtime and guided workflow for repeatable analysis.

### 1.3 Who This Is For

Primary users:

1. Individual analysts who need fast, structured, mobile-friendly analysis.
2. Small teams that want reusable analysis workflows without building a full internal platform.
3. Domain operators who publish templates/agents/skills through a managed hub.

Secondary users:

1. Product and operations stakeholders who need stable, explainable outputs.
2. Technical teams integrating analysis into decision pipelines.

### 1.4 Core Value Proposition

MatchFlow provides:

1. Structured AI output with clear reasoning boundaries.
2. Domain-specific extensibility without client rebuilds.
3. Real-time streaming analysis on mobile.
4. Controlled runtime behavior with compatibility and security checks.

---

## 2. Vision and Positioning

### 2.1 Vision

Build MatchFlow into a **general analysis shell** where domain capabilities can be installed and governed like software packages.

### 2.2 Positioning

MatchFlow is not trying to be:

1. A generic chat UI.
2. A server-only enterprise governance suite.
3. A one-off single-domain prototype.

MatchFlow is positioned as:

1. A client runtime for structured analysis execution.
2. A pluggable ecosystem for domain packs and extensions.
3. A mobile product with production-grade reliability requirements.

---

## 3. Strategic Goals (2026-2027)

## Goal A: Generalize Domain Capability

Deliver a domain-pack architecture so one client can support multiple analysis domains with minimal code branching.

Success indicators:

1. Domain activation and alias behavior are stable.
2. Planning routes can switch by domain context.
3. Domain resource recommendations are syncable in one-click flows.

## Goal B: Stabilize Real-Time Analysis Experience

Ensure real-time preview is stable across model families and tool-call modes.

Success indicators:

1. Streaming preview no longer exhibits high-frequency flicker under reasoning models.
2. Tool-call protocol chunks are handled idempotently in UI parsing.
3. Abort/resume flows stay consistent for long-running analyses.

## Goal C: Build a Safe Extension Runtime

Support dynamic skills and templates while preserving strict runtime control.

Success indicators:

1. Manifest validation blocks malformed or incompatible extensions.
2. Runtime HTTP access is constrained by protocol and host allowlist.
3. Version gating prevents unsupported package installs.

## Goal D: Increase Operational Clarity

Make analysis execution observable and diagnosable from the client side.

Success indicators:

1. Tool-call success/failure and latency become visible in runtime diagnostics.
2. Sync outcomes expose installed/missing/error sets clearly.
3. Failure reasons are actionable (not generic).

## Goal E: Maintain Backward Compatibility While Evolving

Ship architecture upgrades without breaking existing football workflows and user data.

Success indicators:

1. Football remains default fallback domain and planning strategy.
2. Existing local settings and extension stores remain readable.
3. Upgrade path requires no destructive migration.

---

## 4. Product Scope Boundaries

## 4.1 In Scope (Current Phase)

1. Client-side domain abstraction and runtime registry.
2. Domain-pack install/store/activation lifecycle.
3. Strategy-based planning route resolution.
4. Extension runtime improvements (`builtin_alias`, `http_json`, `static_result`).
5. Security hardening for runtime network behavior.
6. Settings and UX surfaces for domain selection and host allowlist.

## 4.2 Out of Scope (Current Phase)

1. Server-side governance redesign.
2. Full multi-tenant policy management in client.
3. Cross-device cloud sync for all local runtime state.
4. Domain-specific business logic beyond installed pack capabilities.

---

## 5. KPI Framework

Use this as the shared scorecard for quarterly reviews.

## 5.1 Experience KPIs

1. Analysis completion success rate.
2. Average time to first meaningful segment.
3. Streaming preview stability rate under reasoning models.

## 5.2 Quality KPIs

1. Tool-call success rate by provider/model.
2. Extension install success rate.
3. Percentage of failures with explicit diagnostic reason.

## 5.3 Platform KPIs

1. Number of active domain packs per release cycle.
2. Percentage of analyses using non-default domains.
3. Time from domain pack publish to client activation.

---

## 6. Delivery Milestones

## Milestone 1: Foundation (Done / In Progress)

1. Domain abstraction and registry.
2. Planning strategy decoupling.
3. Skill runtime mode extension.
4. Domain pack pipeline and basic UI surfaces.

## Milestone 2: Reliability Hardening

1. Streaming parser stability improvements.
2. Tool-call observability panel.
3. Better install/update rejection messages in UI.

## Milestone 3: Ecosystem Readiness

1. Expanded domain strategy library.
2. Stronger contract tests for domain and extension behavior.
3. One-click domain bootstrap playbook.

---

## 7. Product Principles

All roadmap and implementation choices should follow these principles:

1. **Deterministic before clever**: predictable behavior beats opaque intelligence.
2. **Composable by default**: capabilities should be reusable across domains.
3. **Secure by construction**: runtime network and install behavior must be constrained.
4. **Mobile-first practicality**: UX must support real usage under latency and interruptions.
5. **Backward-compatible evolution**: upgrades should preserve prior user value.

---

## 8. Governance and Review Cadence

## 8.1 Review Rhythm

1. Weekly implementation checkpoint (engineering).
2. Bi-weekly product/architecture alignment.
3. Monthly KPI review against this document.

## 8.2 Required Review Inputs

1. Latest KPI snapshot.
2. Top 5 production/runtime issues and root causes.
3. Domain-pack adoption and failure breakdown.
4. Next cycle priorities with explicit tradeoffs.

---

## 9. How to Use This Document

Use this file as:

1. The executive summary for project direction.
2. The alignment baseline for roadmap discussions.
3. The acceptance reference when evaluating major architecture changes.

Update this document whenever:

1. Strategic goals change.
2. Scope boundaries are redefined.
3. KPI definitions or milestone criteria are adjusted.

---

## ZH

## 1. 项目介绍

### 1.1 MatchFlow 是什么

MatchFlow 是一个移动优先的 AI 分析应用，用来把原始、异构数据转换为结构化、可解释的分析结果。

截至 **2026 年 3 月 2 日**，MatchFlow 正在从“足球单域分析应用”升级为**由 Domain Pack 驱动的通用分析平台**：

1. 用户可连接不同数据源服务端。
2. 客户端可发现并安装领域能力包。
3. 分析通过可复用的 Agents、Skills、Templates、动画模块执行。

### 1.2 我们解决的问题

多数分析流程会在以下方面失效：

1. 数据来源分散且结构不一致。
2. 分析结论难复现、难审计。
3. 专家流程被写死在业务代码中，无法组件化复用。
4. 移动端在复杂分析场景体验不足。

MatchFlow 通过可组合运行时和可控工作流，提供可复用、可追踪、可持续演进的分析能力。

### 1.3 目标用户

主要用户：

1. 需要快速结构化分析的个人分析者。
2. 希望复用分析流程、但不希望自建完整平台的小团队。
3. 通过 Hub 发布模板/Agent/Skill 的领域运营方。

次要用户：

1. 关注输出稳定性和可解释性的产品/运营角色。
2. 需要将分析接入决策链路的技术团队。

### 1.4 核心价值

MatchFlow 提供：

1. 有边界、有结构的 AI 分析输出。
2. 不改客户端包体也可扩展领域能力。
3. 面向移动端的实时流式分析体验。
4. 有兼容与安全约束的运行时能力。

---

## 2. 愿景与定位

### 2.1 愿景

把 MatchFlow 打造成一个**通用分析壳**，让领域能力像软件包一样被安装、组合和治理。

### 2.2 产品定位

MatchFlow 不做：

1. 纯聊天式通用 AI UI。
2. 纯服务端治理控制台。
3. 一次性单领域演示应用。

MatchFlow 要做：

1. 结构化分析执行的客户端运行时。
2. 由 Domain Pack 与扩展组成的能力生态。
3. 面向真实生产场景的移动端产品。

---

## 3. 战略目标（2026-2027）

## 目标 A：领域能力通用化

交付 Domain Pack 架构，使一个客户端在最小分支成本下支持多个分析领域。

成功标志：

1. 领域激活与别名行为稳定。
2. 规划路由可依据领域上下文切换。
3. 领域推荐资源可在一键同步中自动注入。

## 目标 B：实时分析体验稳定化

在不同模型族和工具调用模式下，保证实时预览稳定。

成功标志：

1. 推理模型场景下预览高频闪烁显著下降。
2. 工具调用协议片段在 UI 解析中具备幂等处理。
3. 长任务中止/恢复行为保持一致。

## 目标 C：可控的扩展运行时

在支持动态 Skill/Template 的同时保持严格运行时控制。

成功标志：

1. Manifest 校验可拦截不合法或不兼容扩展。
2. 运行时 HTTP 调用受协议与 host 白名单约束。
3. 版本门禁可阻止不支持的包安装。

## 目标 D：运行可观测与可诊断

让客户端分析执行过程具备可观测、可定位能力。

成功标志：

1. Tool call 成功率、失败率、耗时可视化。
2. 推荐同步结果可清晰区分成功/缺失/错误。
3. 错误原因具备可执行性（不是泛化报错）。

## 目标 E：演进中保持兼容

在升级架构时不破坏既有足球流程和用户数据。

成功标志：

1. 足球仍是默认兜底领域与规划策略。
2. 既有本地设置与扩展存储可持续读取。
3. 升级过程无需破坏性迁移。

---

## 4. 范围边界

## 4.1 当前阶段包含

1. 客户端 Domain 抽象与注册机制。
2. Domain Pack 安装/存储/激活生命周期。
3. 策略化规划路由。
4. 扩展运行时能力增强（`builtin_alias`、`http_json`、`static_result`）。
5. 运行时网络安全加固。
6. 设置页与交互层的领域和白名单配置入口。

## 4.2 当前阶段不包含

1. 服务端治理架构重做。
2. 客户端完整多租户策略管理。
3. 所有本地状态的跨设备云同步。
4. 超出已安装能力包的领域业务逻辑开发。

---

## 5. KPI 框架

该 KPI 用于季度复盘统一口径。

## 5.1 体验类 KPI

1. 分析任务完成成功率。
2. 首个有效分析段落的平均耗时。
3. 推理模型场景下流式预览稳定率。

## 5.2 质量类 KPI

1. 按 provider/model 的工具调用成功率。
2. 扩展安装成功率。
3. 带明确可执行原因的错误占比。

## 5.3 平台类 KPI

1. 每个发布周期活跃 Domain Pack 数量。
2. 非默认领域分析占比。
3. Domain Pack 发布到客户端可用的平均时延。

---

## 6. 交付里程碑

## 里程碑 1：基础能力（已完成/进行中）

1. Domain 抽象与注册。
2. 规划策略解耦。
3. Skill 运行时模式扩展。
4. Domain Pack 管线与基础 UI。

## 里程碑 2：稳定性加固

1. 流式解析与预览稳定性优化。
2. 工具调用可观测面板。
3. UI 层更清晰的安装/更新拒绝原因。

## 里程碑 3：生态就绪

1. 扩展领域策略库。
2. 补齐 Domain 与扩展契约测试。
3. 一键领域引导初始化方案。

---

## 7. 产品原则

所有路线与实现都应遵循：

1. **确定性优先于聪明**：可预测行为优先于黑盒智能。
2. **默认可组合**：能力组件应可跨领域复用。
3. **安全内建**：安装与运行时网络行为必须受控。
4. **移动优先实用主义**：在弱网和中断场景也能稳定使用。
5. **兼容式演进**：升级不能破坏已有用户价值。

---

## 8. 治理与评审节奏

## 8.1 评审节奏

1. 每周工程实现检查。
2. 双周产品/架构对齐。
3. 每月 KPI 复盘，对照本文件更新。

## 8.2 评审输入要求

1. 最新 KPI 快照。
2. Top 5 运行问题及根因。
3. Domain Pack 采用率与失败分布。
4. 下一周期优先级及取舍依据。

---

## 9. 本文档用法

本文件用于：

1. 项目方向的统一介绍稿。
2. Roadmap 讨论的基线文档。
3. 大型架构改动的验收参考。

以下场景必须同步更新本文件：

1. 战略目标变化。
2. 范围边界调整。
3. KPI 定义或里程碑验收标准变更。

