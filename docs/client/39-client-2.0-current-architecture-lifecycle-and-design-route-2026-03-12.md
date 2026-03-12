# 客户端 2.0 当前架构图、生命周期与设计路线

日期: 2026-03-12
适用版本: 当前 `main` 工作区中的客户端实现
编写原则: 只基于现版本代码，不引用旧设计稿

## 1. 文档目标

这份文档描述的是当前版本客户端已经真实落地的实现，而不是历史规划。

本文重点回答 3 个问题：

1. 当前客户端到底分成了哪些核心子系统，它们之间如何协作。
2. 应用启动、主管 Agent 对话、分析执行、自动化心跳分别如何流转。
3. 为什么当前 2.0 要采用「通用骨架 + 领域运行时包」这条设计路线，以及当前以足球作为首个验证 pack 的边界在哪里。

## 2. 当前版本一句话概括

当前客户端 2.0 已经不是「页面自己管状态、页面自己决定业务」的结构，而是演进成了下面这套主链：

- UI 只消费投影，不持有业务真相。
- Manager 核心负责会话、运行、上下文装配和回写。
- 对话编排与具体分析执行解耦。
- 领域运行时包负责语义、工作流和数据源接入。
- 本地持久化优先以 SQLite 为主，Web 端退化到 localStorage。

最核心的变化可以概括为一句话：

`Command Center 负责“理解你要做什么”，MatchDetail 负责“真正把分析跑完”。`

## 3. 总体架构图

### 3.1 顶层架构图

```text
+----------------------------------------------------------------------------------+
|                                Client App Shell                                  |
|                        Router + App Lifecycle + Native Bridge                    |
+----------------------------------------------------------------------------------+
            |                            |                              |
            v                            v                              v
  +-------------------+      +---------------------+      +----------------------+
  | Command Center    |      | MatchDetail         |      | Automation Runtime   |
  | 对话入口 / 草稿流 |      | 分析页 / 恢复 / 结果 |      | 调度 / 恢复 / 队列   |
  +-------------------+      +---------------------+      +----------------------+
            |                            |                              |
            v                            v                              v
  +-------------------+      +---------------------+      +----------------------+
  | useCommandCenter  |      | AnalysisContext     |      | runtimeCoordinator   |
  | State             |      | + useAnalysisRuntime|      | + heartbeat          |
  +-------------------+      +---------------------+      +----------------------+
            |                            |                              |
            v                            v                              v
  +-------------------+      +---------------------+      +----------------------+
  | manager compat    |      | executeAnalysisRun  |      | scheduler / recovery |
  | actions/runtime   |      | stream + resume     |      | + queue              |
  +-------------------+      +---------------------+      +----------------------+
            |                            |                              |
            +-------------+--------------+------------------------------+
                          |
                          v
  +--------------------------------------------------------------------------------+
  |                            Local Persistence Layer                             |
  | history / resume / saved subjects / automation drafts-jobs-rules / manager    |
  | sessions-messages-runs-summaries-memories / synced matches                    |
  +--------------------------------------------------------------------------------+
                          |
                          v
  +--------------------------------------------------------------------------------+
  |                            Domain Runtime Pack Layer                           |
  | resolver / sourceAdapters / contextProviders / tools / workflows / policy     |
  | 当前首个 pack: football                                                        |
  +--------------------------------------------------------------------------------+
```

### 3.2 当前真实分层

```text
Presentation
  App.tsx
  pages/CommandCenter.tsx
  pages/MatchDetail.tsx
  pages/Automation.tsx
  components/*

Application State / Read Model
  useCommandCenterState.ts
  useAnalysisRuntime.ts
  useSubjectRecordContext.ts
  useResumeRecoveryState.ts
  AnalysisContext.tsx

Execution Core
  manager-gateway/*
  automation/runtimeCoordinator.ts
  automation/heartbeat.ts
  automation/executionRuntime.ts

Domain Runtime
  domains/runtime/*
  domains/runtime/football/*

Persistence
  services/db.ts
  services/history.ts
  services/savedSubjects.ts
  automation stores
  manager-gateway/sessionStore.ts

Native / Platform Bridge
  Capacitor App
  LocalNotifications
  androidAutomationHost
  nativeScheduler
```

## 4. 当前客户端的“真相”到底放在哪里

这是理解当前架构最重要的一点。

### 4.1 真相存储与 UI 投影的边界

| 业务对象 | 当前真相所在 | UI 看到的形态 |
|---|---|---|
| 主管对话会话 | `manager-gateway/sessionStore.ts` | `ManagerSessionProjection` |
| 主管当前运行态 | `manager_runs` + `runCoordinator` | `projection.activeRun` |
| 主管上下文 | summary + memory + recent turns + domain fragments | `projection.contextSnapshot` |
| 分析执行中的活动态 | `AnalysisContext.activeAnalyses` | `MatchDetail` 的 displayData |
| 分析历史结果 | `history.ts` | `MatchDetail` result 恢复态 |
| 未完成分析续跑态 | `history.ts` 中 resume state | `savedResumeState` |
| 自动化草稿/规则/任务/运行 | automation stores | Automation 页列表与 Command Center draft bundle |
| 领域语义与数据源访问 | `domains/runtime/*` | Manager tool / workflow / query 行为 |

### 4.2 当前 2.0 的核心判断标准

一个页面如果只是把 projection 渲染出来，它就是 UI。

一个模块如果负责：

- 创建/恢复 session
- 排队/中断 run
- 组装上下文
- 挑选 workflow/tool
- 落消息、summary、memory、run record

那它就是核心业务真相层。

当前客户端里，`manager-gateway/gateway.ts` 就是这样一个核心真相入口。

## 5. 各核心子系统说明

## 5.1 App Shell 与全局生命周期

入口在 `src/App.tsx`。

当前应用壳负责的不是页面展示，而是全局运行时启动与平台事件接线：

- 用 `AnalysisProvider` 包住整个 Router，使分析运行态跨页面存在于应用会话内。
- 在 `AppRoutes` 启动时执行 `startAutomationRuntime()`。
- 同时执行 `scheduleNativeAutomationSync('app_startup')`。
- 根据 `document.visibilitychange` 与 `CapacitorApp.appStateChange` 同步 automation runtime 的前后台活跃状态。
- 在 Android 上接管硬件返回键。
- 接管本地通知点击事件，并根据 `route` 或 `domainId + subjectId` 跳转页面。
- 启动 `startAndroidAutomationForegroundHost()`，为 Android 前台执行提供宿主支持。
- 在卸载时停止 automation runtime 与 native listener。

这意味着：

- 当前客户端的最高层生命周期入口不是某个页面，而是 `AppRoutes`。
- 自动化、通知、native wake、前后台切换都属于应用壳层责任，而不是业务页责任。

## 5.2 Command Center

入口在 `src/pages/CommandCenter.tsx`。

这个页面现在已经非常薄，基本只做四件事：

- Conversation 消息流展示
- Run Status 状态展示
- Debug Panel 调试展示
- Composer 输入提交

真正状态管理在 `src/pages/command/useCommandCenterState.ts`。

它当前承担的职责是：

- 读取主 projection
- 同步 automation drafts 到对话投影
- 在 active run 存在时轮询 projection
- 提交用户 turn
- 提交澄清回答
- 激活 draft
- 删除 draft
- 取消当前 run

它不再自己维护主管业务真相，也不再从旧快照恢复会话事实。当前页面只持有：

- `commandText`
- `isSubmitting`
- `isCancellingRun`
- `submitError`
- `projection`

这说明 Command Center 已经从“业务页”收敛成“主管 read model 页”。

## 5.3 Manager Gateway

入口在 `src/services/manager-gateway/gateway.ts`，单例装配在 `src/services/manager-gateway/service.ts`。

这是当前主管 Agent 的真正核心。

### 5.3.1 它负责什么

Manager Gateway 当前负责：

- 获取或创建主管主会话
- 读取完整会话 projection
- 接收用户 turn
- 管理 run 排队与取消
- 解析 active workflow
- 调用 domain runtime pack 的 resolver / workflow / tool
- 组装 context fragments
- 持久化消息、run、summary、memory、session patch
- 返回新的 projection 给 UI

### 5.3.2 当前 turn 流转图

```text
User input
  -> useCommandCenterState.handleParseCommand
  -> compatActions.submitGatewayBackedManagerTurn
  -> manager/runtime.submitManagerTurn
  -> managerGateway.submitMainSessionTurn
  -> getOrCreateMainSession
  -> runCoordinator.reserve(sessionId)
  -> create run record
  -> append user message
  -> reload projection
  -> runtimePack.resolver.resolveIntent(...)
  -> contextAssembler.assemble(...)
  -> route by:
       1) strict llm planner        (when heuristic fallback disabled)
       2) active workflow resume
       3) optional llm planner
       4) deterministic tool fallback
  -> append assistant/system blocks
  -> persist memory writes
  -> refresh session summary
  -> update session patch
  -> update run record
  -> reload projection
  -> UI renders new projection
```

### 5.3.3 当前路由策略不是单一模式，而是四段式

当前 gateway 的 turn 处理是四段式优先级：

1. 严格模式下先走 LLM planner。
2. 如果 session 上有 active workflow，则优先尝试 workflow resume。
3. 如果配置了 LLM planner，再做一次可选 LLM-assisted planning。
4. 如果还没有结果，则落到 domain tools 的 deterministic fallback。

这套结构的意义是：

- 工作流中的多轮澄清不会被普通工具分流打断。
- LLM 不是唯一真相，只是一个 planner 参与者。
- 即使 AI 不可用，系统仍能依靠 deterministic tool 保持最小可用。

### 5.3.4 当前 Manager Context 的真实组成

`src/services/manager-gateway/contextAssembler.ts` 当前会装配这些 fragment：

- latest summary
- recent turns
- relevant memories
- runtime pack 的 domain fragments
- runtime state
- tool affordances

也就是说当前上下文不再只是“最近几条消息”，而是已经变成一个可扩展的上下文拼装器。

### 5.3.5 Summary 与 Memory 已经是正式能力

`summaryService.ts` 当前会在消息足够多后生成滚动摘要，用于压缩旧对话。

`memoryService.ts` 当前会从：

- session scope
- domain scope
- global scope

拉取相关 memory，并按 importance + updatedAt 去重排序。

这意味着当前主管上下文已经具备：

- 短期上下文: recent turns
- 中期上下文: rolling summary
- 长期上下文: memory records

### 5.3.6 RunCoordinator 的职责

`src/services/manager-gateway/runCoordinator.ts` 负责按 session 串行化 run。

它解决的是：

- 同一 session 下多个 turn 并发提交
- queued run 取消
- running run 中断
- session 级独占执行

所以当前主管不会因为用户快速连点发送而把会话状态打坏。

## 5.4 MatchDetail 与 Analysis Runtime

入口页是 `src/pages/MatchDetail.tsx`。

这个页面现在已经明确是“具体分析执行页”，不是主管对话页的延伸。

### 5.4.1 MatchDetail 的职责

它当前负责：

- 按 `/subject/:domainId/:subjectId` 打开目标主题
- 恢复 subject 的历史记录、保存记录、resume 快照
- 允许用户编辑分析输入数据
- 启动/恢复具体分析
- 展示 analyzing 过程和最终结果
- 导出 PDF / 分享二维码

### 5.4.2 当前 subject 恢复优先级

当前页面会按如下优先级恢复展示对象：

1. 路由 state 里的 `importedData`
2. 当前内存中的 `activeAnalysis`
3. 本地 history record
4. saved subject
5. recoverable resume snapshot
6. builtin local case
7. `MOCK_MATCHES`

这说明当前页面已经是“多来源恢复页”，而不是单纯依赖实时分析结果。

### 5.4.3 MatchDetail 自身的阶段状态

当前页内部阶段是三段式：

- `selection`
- `analyzing`
- `result`

这个阶段不是由 URL 控制，而是由 `useAnalysisRuntime.ts` 基于：

- `activeAnalysis`
- `historyRecord`

自动推导。

### 5.4.4 AnalysisContext 的职责

`src/contexts/AnalysisContext.tsx` 是当前分析运行态容器。

它维护：

- `activeAnalyses`
- `startAnalysis`
- `stopAnalysis`
- `clearActiveAnalysis`
- `setCollapsedSegments`

其本质是：

- 应用内存中的“活动分析真相”
- 并为每个 subjectKey 维护自己的 abort controller 与用户中止状态

### 5.4.5 executeAnalysisRun 的职责

`src/services/automation/executionRuntime.ts` 是当前真正的分析执行核心。

它负责：

- 解析 subjectRef
- bootstrap resume state
- 创建初始 ActiveAnalysis snapshot
- 调用 `streamAgentThoughts(...)`
- 按 chunk 更新 thoughts、parsedStream、runtimeStatus、runMetrics
- 周期性写入 resume snapshot
- 在完成时构造 `AnalysisOutputEnvelope`
- 保存 history
- 清理 saved subject
- 清除 resume state
- 在失败或取消时持久化相应 runtimeStatus

### 5.4.6 当前分析页与主管页的关系

当前两者是明确解耦的：

- Command Center 负责理解指令、补全任务、生成 draft、触发导航。
- MatchDetail 负责跑 planner runtime、保存历史、处理恢复和结果呈现。

这比旧结构更稳定，因为：

- 对话多轮澄清不再污染分析执行页状态。
- 分析执行的恢复与中断不需要通过对话 session 模拟。
- 页面职责边界更清楚。

## 5.5 Automation Runtime

入口在 `src/services/automation/runtimeCoordinator.ts`。

这个模块是当前后台自动化的总控器。

### 5.5.1 runtimeCoordinator 当前负责什么

- 保存全局 automation runtime snapshot
- 决定当前是否应该 poll
- 根据 app active/background 与 host type 调整轮询频率
- 触发 heartbeat
- 对外发布 runtime 状态订阅

状态机当前是：

- `idle`
- `running`
- `paused`
- `error`

### 5.5.2 Heartbeat 当前做什么

`src/services/automation/heartbeat.ts` 当前每次 heartbeat 会做三件事：

1. `scheduler` 生成未来应执行的 job。
2. `recovery` 把 due job、retry job、stale running job 重新归位。
3. `queue` 在预算允许下执行 eligible jobs。

所以当前自动化不是“轮询然后直接执行”，而是：

`调度 -> 恢复 -> 排队执行`

### 5.5.3 Draft 激活有两条主路径

从 Command Center 激活 draft 时，当前有两种路径：

#### 路径 A: `run_now`

- 通过 `resolveImmediateAnalysisNavigation(...)`
- 直接跳到 `/subject/:domainId/:subjectId`
- 在路由 state 中携带 `importedData + autoStartAnalysis`
- MatchDetail 进入页后自动启动分析

#### 路径 B: `save_only`

- 通过 `activateAutomationDraft(...)`
- recurring draft 生成 rule
- one-time draft 生成 job
- 然后 `kickAutomationRuntime('draft_activated')`

因此，当前“立即分析”和“自动化任务”在激活之后已经是两条不同的执行主链。

## 5.6 Domain Runtime Pack

入口是 `src/domains/runtime/types.ts` 和 `src/domains/runtime/registry.ts`。

这是 2.0 重构中最关键的通用化骨架。

### 5.6.1 当前 runtime pack 合同

一个 `DomainRuntimePack` 当前由以下部分组成：

- `manifest`
- `resolver`
- `sourceAdapters`
- `contextProviders`
- `tools`
- `workflows`
- `memoryPolicy`
- `queryCatalog`
- `legacyAdapters`

这意味着领域扩展不再只是“换几个提示词”，而是可以独立定义：

- 意图解析
- 数据源读取
- 上下文注入
- 工具能力
- 多轮工作流
- memory 写入策略

### 5.6.2 当前足球 pack 的真实形态

当前唯一正式运行时 pack 是 `footballRuntimePack`。

它已经具备：

- `resolver`
- `sourceAdapters`
- `tools`
- `workflows`
- `queryCatalog`
- `legacyAdapters`

其中比较关键的是：

- sourceAdapters: 先查 server matches，再退 builtin local cases
- tools: 查询比赛、解释能力、准备任务 intake、fallback help
- workflows: `football_task_intake` 多轮澄清工作流

### 5.6.3 现在已经具备“热插拔骨架”，但还不是任意运行时代码热加载

这点要写清楚。

当前客户端已经为“热插拔不同领域数据源”打下了结构基础，体现在：

- runtime pack 有独立的 source adapter 合同
- queryCatalog 已经把 query type 和 adapter 链绑定起来
- context assembler 会把 mounted source adapters 注入 context
- UI domain registry 会把 installed pack manifest 合并为 runtime domain alias

但是当前真实执行层仍有一个边界：

- `runtime/registry.ts` 目前只注册了 builtin football runtime pack
- 已安装 pack 的 runtime 侧解析方式是“alias 到 baseDomainId 对应的内建 runtime pack”
- 也就是说，当前已经支持“数据与资源配置层的热插拔别名”，但尚未支持“下载一段新 runtime code 后直接执行”

这并不是坏事，而是当前阶段的刻意收敛：

- 先把运行时合同稳定下来
- 再逐步开放真正的 pack 级运行时代码扩展

### 5.6.4 当前尚轻量的部分

目前足球 pack 里 `contextProviders` 仍然是 stub，说明：

- 上下文扩展位已经打通
- 但 domain-aware fragment 目前还没有大规模填充

这属于“骨架已到位，内容还可继续增强”的状态。

## 6. 生命周期

## 6.1 应用启动生命周期

```text
App mount
  -> AnalysisProvider created
  -> Router mounted
  -> AppRoutes useEffect
  -> startAutomationRuntime()
  -> scheduleNativeAutomationSync('app_startup')
  -> setAutomationRuntimeAppActive(current visibility)
  -> startAndroidAutomationForegroundHost()
  -> consume pending native wake events
  -> register native wake listener
  -> check background notification permissions
  -> bind back button listener
  -> bind local notification tap listener
  -> bind visibilitychange listener
  -> bind appStateChange listener
  -> render current route
```

应用退出或 AppRoutes 卸载时：

- 移除监听器
- 停止 Android foreground host
- `stopAutomationRuntime()`

## 6.2 Command Center 对话生命周期

```text
CommandCenter mount
  -> useCommandCenterState()
  -> loadGatewayBackedManagerMainProjection()
  -> projection -> feedAdapter -> conversation feed
  -> syncGatewayBackedManagerConversationWithDrafts()
  -> 若存在 draft，则补齐 draft_bundle 投影

User submit
  -> submitGatewayBackedManagerTurn()
  -> manager/runtime.submitManagerTurn()
  -> gateway.submitMainSessionTurn()
  -> sessionStore append user message
  -> resolve intent + assemble context
  -> workflow / llm / tool route
  -> append assistant blocks
  -> persist summary + memory + run/session patch
  -> reload projection
  -> setProjection(nextProjection)
  -> if shouldRefreshTaskState -> refreshAll()

If projection.activeRun exists
  -> page polls projection every 900ms
  -> run status and feed update continuously
```

## 6.3 Draft 澄清与激活生命周期

```text
User answers clarification
  -> submitGatewayBackedManagerClarificationAnswer()
  -> manager/runtime.submitManagerClarificationAnswer()
  -> update automation draft
  -> append user + agent messages into manager conversation
  -> reload projection

User activates draft
  -> submitGatewayBackedManagerDraftActivation()
  -> if draft.activationMode === run_now
       -> resolveImmediateAnalysisNavigation()
       -> navigate('/subject/:domainId/:subjectId', state)
     else
       -> activateAutomationDraft()
       -> save rule or job
       -> kickAutomationRuntime('draft_activated')
  -> append manager feedback message
  -> reload projection
```

## 6.4 MatchDetail 打开与恢复生命周期

```text
Route open: /subject/:domainId/:subjectId
  -> resolve active domain from route
  -> useSubjectRecordContext()
       -> load history
       -> if no history, load saved subject
       -> load resume snapshot subject display
  -> locate activeAnalysis from AnalysisContext
  -> choose subject display source by priority
  -> useResumeRecoveryState()
       -> if no completed result and no active analyzing, load recoverable resume
  -> useAnalysisRuntime()
       -> infer step = selection / analyzing / result
  -> render page

If route state has autoStartAnalysis = true
  -> and current step is selection
  -> and editableData ready
  -> auto start analysis once
```

## 6.5 分析执行生命周期

```text
User clicks startAnalysis
  -> MatchDetail/useAnalysisRuntime.startAnalysis()
  -> parse editableData JSON
  -> fetchSubjectAnalysisConfig() or resolveSubjectAnalysisConfig()
  -> merge server planning into payload
  -> inject sourceContext.domainId
  -> AnalysisContext.startAnalysis()
  -> executeAnalysisRun()

executeAnalysisRun()
  -> resolve subjectRef
  -> bootstrap resume state
  -> create initial ActiveAnalysis snapshot
  -> streamAgentThoughts(...)
  -> on every chunk:
       -> update thoughts
       -> parse stream into segments
       -> update runtimeStatus / runMetrics
       -> persist resume snapshot
       -> push snapshot back to AnalysisContext
  -> on completed:
       -> build AnalysisOutputEnvelope
       -> saveHistory(...)
       -> deleteSavedSubject(...)
       -> clearResumeState(...)
       -> mark runtimeStatus = completed
  -> on abort:
       -> mark runtimeStatus = cancelled
       -> keep resume snapshot for continue
  -> on failed:
       -> mark runtimeStatus = failed
       -> keep resume snapshot for later recovery
```

## 6.6 Automation Heartbeat 生命周期

```text
runtimeCoordinator tick
  -> resolveAutomationRuntimePollingDecision()
  -> if shouldPoll = false
       -> status = paused or error
       -> schedule next tick
  -> if shouldPoll = true
       -> status = running
       -> runAutomationHeartbeat()
            -> scheduler cycle
            -> recovery reconcile
            -> optional queue cycle
       -> publish runtime snapshot
       -> status = idle or error
       -> schedule next tick by app state / host durability
```

这条生命周期的关键不是“固定每 30 秒跑一次”，而是：

- 前台与后台频率不同
- 背景是否允许取决于 host durability
- 所有决策都经过 `resolveAutomationRuntimePollingDecision()`

## 7. 设计路线

## 7.1 第一原则: 把“聊天”与“执行”拆开

如果把主管对话和分析执行绑死在一起，会出现三个问题：

1. 多轮澄清会污染分析页。
2. 分析中断、恢复、历史回放很难处理。
3. 不同领域未来会把一个页面堆成巨大的耦合点。

所以当前 2.0 的第一条设计路线就是：

- Command Center 负责任务理解与编排
- MatchDetail 负责具体执行与结果呈现

## 7.2 第二原则: UI 不再持有业务真相

旧式做法通常是：

- 页面本地 state 就是真相
- localStorage 快照是兜底

这会导致：

- 恢复逻辑散落在多个页面
- run 生命周期无法统一管理
- 后续 automation / native wake 很难挂接

所以 2.0 当前改成：

- 主管真相进入 gateway + session store
- 分析执行真相进入 AnalysisContext + resume/history
- UI 只渲染 projection

## 7.3 第三原则: 领域能力必须下沉到 runtime pack

如果主管核心里直接写死足球逻辑，那么后续想接别的领域会非常痛苦。

所以现在把领域特有部分下沉到 runtime pack：

- resolver 决定如何理解意图
- sourceAdapters 决定如何读数据
- contextProviders 决定如何补领域上下文
- tools 决定如何执行领域动作
- workflows 决定如何进行多轮任务 intake

这样主管核心只负责编排，不负责领域语义本身。

## 7.4 第四原则: 先稳定合同，再开放真正的热插拔

当前我们的设计目标明确不是“只做足球 App”，而是：

- 未来通过热插拔不同领域数据源
- 实现不同事件类型的分析

所以当前阶段做法是：

1. 先把 runtime pack 合同做实。
2. 先让 football pack 成为首个正式 pack。
3. 先让 UI、gateway、query adapter、workflow、history 都围绕这个合同转起来。
4. 等合同稳定后，再开放更强的 pack 级执行扩展。

这条路线的好处是：

- 当前不会为了“未来可扩展”而把系统做成抽象空壳
- 同时也没有把足球逻辑硬编码死在主管核心

## 7.5 为什么当前先以足球为例子

因为足球场景同时覆盖了以下几类复杂性：

- 事件列表查询
- 单场主题分析
- 本地数据与服务端数据双源切换
- 多轮澄清任务 intake
- 立即分析与自动化任务双路径激活
- 历史结果、恢复执行、前后台运行

如果这套骨架能把足球场景跑顺，后续扩展到其他事件域时，复用价值就足够高。

## 8. 当前状态评估

## 8.1 已经完成并稳定下来的部分

- 应用壳已经接管 automation runtime、native wake、前后台生命周期。
- Command Center 已经改成 projection-first。
- 主管会话、消息、run、summary、memory 已进入正式 session store。
- Manager Gateway 已经成为真正的单一入口。
- 对话编排与分析执行已经分层。
- MatchDetail 已经走 `/subject/:domainId/:subjectId` 主链。
- 分析执行已经具备 resume / cancel / history / result 恢复能力。
- football runtime pack 已经不只是合同，而是实际执行链的一部分。

## 8.2 当前仍然存在的桥接层

- `compatActions.ts` 仍然是 Command Center 调 gateway 的兼容边界。
- `manager/runtime.ts` 仍在承接 automation draft、legacy snapshot 转换等桥接职责。
- `legacyCompat.ts` 仍把 projection 投影成旧式 conversation snapshot 给部分调用方复用。

这些桥接层不再是业务真相，但仍然是现阶段必要的适配层。

## 8.3 当前还未完全扩展完成的点

- football context providers 目前仍是 stub。
- runtime registry 目前只有 builtin football runtime pack 真正可执行。
- installed pack 目前更多是 manifest alias 与资源层扩展，不是任意 runtime code 热加载。
- 分析执行页虽然已经走 subject 路由，但内部类型仍然偏 `Match` / `MatchAnalysis` 语义。

这说明当前 2.0 的主骨架已经立住，但“多领域内容填充”还没有全部铺开。

## 9. 结论

当前版本客户端已经形成了一套比较清晰的 2.0 架构：

- App Shell 管全局生命周期
- Command Center 管任务理解与会话编排
- Manager Gateway 管 session / context / run / persistence
- MatchDetail + AnalysisContext 管具体分析执行
- Automation Runtime 管后台调度与恢复
- Domain Runtime Pack 管领域语义和数据源接入

最关键的价值不在于“模块变多了”，而在于职责终于被拆清了：

- 聊天不再冒充执行引擎
- 页面不再冒充业务真相
- 领域逻辑不再硬编码在主管核心
- 数据源热插拔已经有了可持续演进的着力点

这就是当前客户端 2.0 的真实状态。

## 10. 代码锚点

下面这些文件是当前架构最关键的代码锚点：

- `src/App.tsx`
- `src/pages/CommandCenter.tsx`
- `src/pages/command/useCommandCenterState.ts`
- `src/services/manager-gateway/gateway.ts`
- `src/services/manager-gateway/contextAssembler.ts`
- `src/services/manager-gateway/sessionStore.ts`
- `src/services/manager-gateway/runCoordinator.ts`
- `src/services/manager/runtime.ts`
- `src/pages/MatchDetail.tsx`
- `src/contexts/AnalysisContext.tsx`
- `src/pages/matchDetail/useAnalysisRuntime.ts`
- `src/pages/matchDetail/useSubjectRecordContext.ts`
- `src/pages/matchDetail/useResumeRecoveryState.ts`
- `src/services/automation/executionRuntime.ts`
- `src/services/automation/runtimeCoordinator.ts`
- `src/services/automation/heartbeat.ts`
- `src/services/history.ts`
- `src/services/db.ts`
- `src/domains/runtime/types.ts`
- `src/domains/runtime/registry.ts`
- `src/domains/runtime/football/index.ts`
- `src/domains/runtime/football/sourceAdapters.ts`
- `src/domains/runtime/football/tools.ts`
- `src/domains/runtime/football/workflows.ts`
