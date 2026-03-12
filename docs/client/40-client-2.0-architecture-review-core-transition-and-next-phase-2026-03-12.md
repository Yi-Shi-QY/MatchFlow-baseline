# 客户端 2.0 架构复盘、稳定内核、过渡层与下一阶段讨论

日期: 2026-03-12
适用范围: 当前 `main` 工作区中的客户端 2.0 实现
关联文档:
- `docs/plans/2026-03-12-manager-2.0-cleanup-next-phase-plan.md`
- `docs/client/39-client-2.0-current-architecture-lifecycle-and-design-route-2026-03-12.md`

## 1. 文档目的

这份文档用于把当前客户端 2.0 的开发目标、架构分层、运行主链、真相边界和下一阶段演进议题，用一份更适合团队讨论的中文材料固定下来。

它不是历史设计稿，也不是未来愿景图，而是基于当前工作区代码和当日回归验证整理出的“现状说明 + 讨论底稿”。

本文重点回答 5 个问题：

1. 我们当前这轮客户端开发到底在收什么尾。
2. 当前客户端 2.0 的真实架构长什么样。
3. 哪些部分已经是稳定内核，哪些部分仍然是过渡层。
4. 为什么现在要先收敛到 `manager gateway + runtime domain pack` 这条主链。
5. 下一阶段如果继续从 `football-first` 走向 `multi-domain`，应该优先谈什么，不应该过早谈什么。

## 2. 当前开发目标

当前这轮开发的主目标并不是“再加一个新页面”或“继续堆功能”，而是把客户端 2.0 的核心架构收口，确保系统以后能在同一个主链上继续长。

一句话概括：

`让客户端彻底以 manager gateway + runtime domain pack 作为单一真相源，清掉旧 command-center 本地兼容路径留下的尾巴。`

拆开说，当前目标包括 4 件事：

1. `/automation` 页面不再持有旧 command-center 本地会话状态，只消费自动化与 gateway 投影出来的数据。
2. football 领域里残留的 legacy workflow 命名与兼容分支要收敛到 2.0 runtime 合同。
3. `DomainRuntimePack`、`sourceAdapters`、`contextProviders` 这套合同要冻结下来，manager 核心不能再隐含 football-specific 假设。
4. 把 manager 2.0 主链的回归门跑通，确认从 `CommandCenter -> clarification -> activation -> MatchDetail -> history/resume -> automation heartbeat` 的路径是稳定的。

## 3. 当前版本一句话概括

当前客户端 2.0 已经不是“页面自己管状态、页面自己决定业务”的结构，而是下面这条主链：

- UI 只消费投影，不持有业务真相。
- Manager Gateway 负责会话、上下文、运行和回写。
- Command Center 负责“理解你要做什么”。
- MatchDetail 负责“真正把分析跑完并且可恢复”。
- Automation Runtime 负责后台调度、恢复和队列。
- Domain Runtime Pack 负责领域语义、工作流和数据源接入。

最核心的结构变化可以压缩成一句话：

`聊天不再冒充执行引擎，页面不再冒充业务真相。`

## 4. 三视角架构图

## 4.1 C4 / 容器视角

```text
+====================================================================================================+
|                                      MatchFlow Client 2.0                                          |
|                                  React + Vite + Capacitor Shell                                    |
+====================================================================================================+

  [User]
     |
     v
+---------------------------+              +----------------------------------+
| UI / Presentation Layer   |              | Native / Platform Bridge         |
|---------------------------|              |----------------------------------|
| CommandCenter             |<-----------> | Capacitor App                    |
| MatchDetail               |              | LocalNotifications               |
| Automation                |              | Android Foreground Host          |
| Settings / DataSources    |              | Native Scheduler / Wake Events   |
+---------------------------+              +----------------------------------+
            |
            v
+-----------------------------------------------------------------------------------+
| Application Read Models / Page State                                              |
|-----------------------------------------------------------------------------------|
| useCommandCenterState                                                              |
| useAnalysisRuntime                                                                 |
| useSubjectRecordContext                                                            |
| useResumeRecoveryState                                                             |
| AnalysisContext                                                                    |
+-----------------------------------------------------------------------------------+
            |
            v
+-----------------------------------------------------------------------------------+
| Execution Core                                                                     |
|-----------------------------------------------------------------------------------|
| Manager Gateway                                                                    |
| - session load/create                                                              |
| - run coordination                                                                 |
| - context assembly                                                                 |
| - workflow/tool routing                                                            |
| - summary/memory persistence                                                       |
|                                                                                   |
| Analysis Runtime                                                                   |
| - executeAnalysisRun                                                               |
| - streamAgentThoughts                                                              |
| - resume/cancel/finalize                                                           |
|                                                                                   |
| Automation Runtime                                                                 |
| - runtimeCoordinator                                                               |
| - heartbeat                                                                        |
| - scheduler / recovery / queue                                                     |
+-----------------------------------------------------------------------------------+
            |
            v
+-----------------------------------------------------------------------------------+
| Persistence Layer                                                                  |
|-----------------------------------------------------------------------------------|
| manager-gateway/sessionStore                                                       |
| history / resume                                                                   |
| savedSubjects                                                                      |
| automation draft/job/rule/run stores                                               |
| syncedMatches                                                                      |
| db.ts                                                                              |
| SQLite first, localStorage fallback on web                                         |
+-----------------------------------------------------------------------------------+
            |
            v
+-----------------------------------------------------------------------------------+
| Domain Runtime Layer                                                               |
|-----------------------------------------------------------------------------------|
| runtime registry                                                                   |
| DomainRuntimePack contract                                                         |
| - manifest                                                                         |
| - resolver                                                                         |
| - sourceAdapters                                                                   |
| - contextProviders                                                                 |
| - tools                                                                            |
| - workflows                                                                        |
| - memoryPolicy                                                                     |
| - queryCatalog                                                                     |
|                                                                                   |
| 当前 built-in pack: football                                                       |
+-----------------------------------------------------------------------------------+
            |
            v
+-----------------------------------------------------------------------------------+
| Data Sources                                                                       |
|-----------------------------------------------------------------------------------|
| remote match server                                                                |
| local built-in cases                                                               |
| local synced cache                                                                 |
+-----------------------------------------------------------------------------------+
```

这张图的重点不是“层次很多”，而是“真相被拆到了正确的位置”：

- UI 负责展示，不负责任务真相。
- Execution Core 负责行为编排。
- Persistence 负责落事实。
- Domain Runtime 负责领域语义，而不是把足球逻辑塞进 manager 核心。

## 4.2 生命周期主链视角

### 4.2.1 App 启动主链

```text
App mount
  -> AnalysisProvider created
  -> Router mounted
  -> AppRoutes effect runs
  -> startAutomationRuntime()
  -> scheduleNativeAutomationSync('app_startup')
  -> setAutomationRuntimeAppActive(...)
  -> startAndroidAutomationForegroundHost()
  -> register native wake / appState / visibility / notification listeners
  -> render current route
```

这意味着客户端的最高层入口不是某个业务页，而是 `AppRoutes`。自动化、通知、native wake、foreground host 都属于 App Shell 职责。

### 4.2.2 Command Center 对话主链

```text
CommandCenter mount
  -> useCommandCenterState()
  -> loadGatewayBackedManagerMainProjection()
  -> projection rendered as feed
  -> sync drafts into conversation projection if needed

User submits message
  -> submitGatewayBackedManagerTurn()
  -> manager/runtime.submitManagerTurn()
  -> managerGateway.submitMainSessionTurn()
  -> sessionStore append user message
  -> runCoordinator.reserve(sessionId)
  -> runtimePack.resolver.resolveIntent(...)
  -> contextAssembler.assemble(...)
  -> route in priority order:
       1) strict LLM planner
       2) active workflow resume
       3) optional LLM-assisted planner
       4) deterministic tool fallback
  -> append assistant/system blocks
  -> persist memory writes
  -> refresh summary
  -> patch session / run
  -> reload projection
  -> UI rerenders
```

这里最重要的是：页面现在读 projection、提 action，不再自己维护 manager 会话事实。

### 4.2.3 Draft 澄清与激活主链

```text
User answers clarification
  -> submitGatewayBackedManagerClarificationAnswer()
  -> manager/runtime.submitManagerClarificationAnswer()
  -> update automation draft
  -> append user + assistant messages into manager conversation
  -> reload projection

User activates draft
  -> submitGatewayBackedManagerDraftActivation()
  -> if activationMode == run_now
       -> resolveImmediateAnalysisNavigation(...)
       -> navigate('/subject/:domainId/:subjectId', state.autoStartAnalysis=true)
     else
       -> activateAutomationDraft()
       -> save rule or job
       -> kickAutomationRuntime('draft_activated')
  -> append manager feedback
  -> reload projection
```

这条链已经明确分成两条执行路径：

- `run_now`: 直接进入分析执行页。
- `save_only`: 进入自动化调度系统。

### 4.2.4 MatchDetail 分析执行主链

```text
Route open: /subject/:domainId/:subjectId
  -> useSubjectRecordContext()
       -> load history
       -> load saved subject
       -> load resume subject display
  -> read activeAnalysis from AnalysisContext
  -> useResumeRecoveryState()
  -> useAnalysisRuntime()
       -> infer page step: selection / analyzing / result

If autoStartAnalysis
  -> startAnalysis()
  -> resolve analysis config
  -> AnalysisContext.startAnalysis()
  -> executeAnalysisRun()
  -> streamAgentThoughts(...)
  -> update active analysis snapshot
  -> persist resume snapshots
  -> on completed -> save history + clear resume
  -> on failed/cancelled -> keep resume for recovery
```

这里是 2.0 和旧版本差别最大的地方之一：Command Center 不再承担具体分析执行逻辑；MatchDetail 才是具体执行与恢复容器。

### 4.2.5 Automation Heartbeat 主链

```text
runtimeCoordinator tick
  -> resolveAutomationRuntimePollingDecision()
  -> if shouldPoll = false
       -> paused/error
       -> schedule next tick
  -> if shouldPoll = true
       -> status = running
       -> heartbeat()
            -> scheduler
            -> recovery
            -> queue
       -> publish runtime snapshot
       -> status = idle/error
       -> schedule next tick
```

也就是说自动化不是“轮询然后直接执行”，而是：

`调度 -> 恢复 -> 排队执行`

## 4.3 真相边界视角

```text
+===================================================================================================+
|                                Truth Boundaries / Source of Truth                                 |
+===================================================================================================+

[UI Layer]
  Owns:
  - temporary input state
  - loading flags
  - selected tabs / page-local interaction state

  Does NOT own:
  - manager conversation truth
  - active manager run truth
  - workflow truth
  - analysis history truth
  - automation task truth

-----------------------------------------------------------------------------------------------------

[Manager Gateway]
  Owns:
  - main session creation / loading
  - session projection
  - active run orchestration
  - workflow routing / resume
  - context assembly
  - message persistence
  - summary / memory writes

-----------------------------------------------------------------------------------------------------

[Analysis Runtime + AnalysisContext]
  Owns:
  - active analyses in memory
  - per-subject abort controller / cancellation state
  - stream progress
  - current runtimeStatus / runMetrics
  - in-flight resume snapshots

-----------------------------------------------------------------------------------------------------

[History / Resume Persistence]
  Owns:
  - completed analysis history
  - recoverable resume state
  - subject restore sources

-----------------------------------------------------------------------------------------------------

[Automation Runtime]
  Owns:
  - drafts / rules / jobs / runs
  - heartbeat decisions
  - scheduler / recovery / queue lifecycle

-----------------------------------------------------------------------------------------------------

[Domain Runtime Pack]
  Owns:
  - domain semantics
  - intent resolution
  - event/subject query access
  - domain workflows
  - domain tool affordances
  - context fragments for manager

-----------------------------------------------------------------------------------------------------

[Bridge / Transitional Adapters]
  Still exists:
  - manager-gateway/compatActions.ts
  - manager/runtime.ts
  - manager-gateway/legacyCompat.ts

  Status:
  - adapter only
  - not source of truth
  - should continue shrinking over time
```

这张图的团队级结论是：

- 页面是 `projection consumer`
- gateway/runtime 是 `orchestrator`
- persistence 是 `fact store`
- runtime pack 是 `domain semantics provider`

## 5. 当前哪些部分已经是稳定内核

从当前代码结构和回归验证看，下面这些已经属于 2.0 稳定内核，不应该轻易推翻：

### 5.1 App Shell 承担全局生命周期

`src/App.tsx` 统一接管 automation runtime、native wake、通知点击、前后台切换、Android 前台执行宿主，这个边界已经是对的。

### 5.2 Command Center 只做 read model + action submit

`src/pages/CommandCenter.tsx` 和 `src/pages/command/useCommandCenterState.ts` 已经从“业务页”收敛成“投影页 + 提交动作的 UI 壳”，这条边界需要继续保持。

### 5.3 Manager Gateway 是 manager 真相单入口

`src/services/manager-gateway/gateway.ts`、`sessionStore.ts`、`runCoordinator.ts`、`contextAssembler.ts` 现在已经共同构成 manager 真相层，这是 2.0 最核心的设计成果。

### 5.4 MatchDetail 与分析执行已经解耦于对话页

`src/pages/MatchDetail.tsx`、`src/pages/matchDetail/useAnalysisRuntime.ts`、`src/contexts/AnalysisContext.tsx`、`src/services/automation/executionRuntime.ts` 这套链路已经明确承担“具体执行 + 恢复 + 历史结果回放”。

### 5.5 Automation Runtime 已经独立成后台主链

`runtimeCoordinator -> heartbeat -> scheduler/recovery/queue` 的分层已经成立，不应该再把自动化逻辑塞回聊天页或单个页面 hook 里。

### 5.6 Domain Runtime Pack 合同已经是主骨架

`src/domains/runtime/types.ts` 和 `src/domains/runtime/registry.ts` 现在已经把“领域语义能力”从 manager 核心拆了出去。哪怕未来 pack 形态继续进化，这条边界本身也不应该倒回去。

## 6. 当前哪些部分仍然是过渡层

这部分最适合团队开会时单独拎出来说，因为它们不是 bug，但它们也不应该永久保留。

### 6.1 compatActions 仍然存在

`src/services/manager-gateway/compatActions.ts` 目前仍然承担 Command Center 对 gateway 的一层兼容封装。

问题不在于它存在，而在于它意味着 UI 到 gateway 之间还不是最短路径。

### 6.2 manager/runtime.ts 仍承担桥接职责

`src/services/manager/runtime.ts` 当前还在承接 draft 激活、legacy snapshot 转换、部分兼容路由。这说明 manager 入口虽然已经稳定，但还没彻底“瘦身到纯业务编排”。

### 6.3 legacyCompat 仍把 projection 投影回旧式快照

`src/services/manager-gateway/legacyCompat.ts` 还在把新投影映射回旧 shape 给部分调用方复用。它已经不是业务真相层，但它证明系统里仍有旧接口消费者存在。

### 6.4 runtime registry 目前只有 football 真正可执行

`src/domains/runtime/registry.ts` 目前只注册 built-in football runtime pack。已安装 pack 更多是 alias / manifest 层扩展，不是任意 runtime code 热加载。

### 6.5 football contextProviders 仍偏轻

当前 football pack 虽然已经具备 `resolver/sourceAdapters/tools/workflows/queryCatalog`，但 `contextProviders` 仍比较轻量。这说明骨架已通，但领域上下文内容填充还没有完全做深。

### 6.6 MatchDetail 内部语义仍偏 match

虽然页面路由已经是 `/subject/:domainId/:subjectId`，但分析执行内部类型和展示语义仍有明显 `Match / MatchAnalysis` 倾向。这会影响未来多领域通用化的最后一段路。

## 7. 为什么当前先收敛到 football-first，而不是直接做真正多领域热插拔

这个问题必须说清楚，否则后面讨论很容易失焦。

当前之所以先让 football 成为第一个正式 runtime pack，不是因为系统目标只是“做足球”，而是因为足球场景一次性覆盖了 2.0 主骨架里最关键的复杂性：

- 事件列表查询
- 单主题分析
- 远端数据源 + 本地 fallback
- 多轮任务澄清
- 立即执行与自动化双路径激活
- 历史结果与 resume 恢复
- App 前后台与 automation heartbeat 协同

也就是说，football 不是终点，而是第一个足够复杂、足够真实的验证 pack。

当前阶段不直接做“任意 runtime code 热加载”的原因也很明确：

1. 如果 runtime 合同还没稳定，先做热加载只会把系统复杂度提前引爆。
2. 当前真正需要验证的不是“下载代码然后跑”，而是“manager / history / automation / context / subject route 能否围绕同一合同协作”。
3. 只有当 pack 合同、生命周期、真相边界都稳定以后，真正的 pack 级热插拔才值得讨论。

所以现在正确的路线是：

- 先稳定合同
- 再增加 pack 数量
- 最后再考虑 pack 代码级热插拔

## 8. 下一阶段最值得讨论的议题

在当前 2.0 主骨架已经立住的前提下，下一阶段建议讨论的是下面 4 个主题，而不是重新推翻主链。

### 8.1 过渡层怎么继续缩小

需要明确哪些调用方还依赖 `compatActions`、`manager/runtime.ts`、`legacyCompat.ts`，然后逐步把它们收敛到：

- UI 直接面向 gateway projection/action contract
- manager runtime 只剩真正需要的 orchestration 能力
- legacy snapshot 不再是默认输出

### 8.2 subject 通用化怎么继续推进

目前 `MatchDetail` 虽然已经走 subject route，但内部仍有较强的比赛语义。下一步要讨论的是：

- 哪些类型已经可以抽象成 domain-neutral
- 哪些 presenter / export / form 仍应留在 football pack
- subject 页的通用骨架和 domain-specific 组件边界怎么划

### 8.3 第二个 runtime pack 何时引入

在 football 之外引入第二个 pack 的意义，不是为了功能数量，而是为了验证：

- runtime registry 是否真的 domain-neutral
- context assembler 是否只消费 canonical fragments
- source adapter / query catalog 是否足够通用
- manager workflow/tool route 是否还夹带 football 假设

### 8.4 automation 与 manager 的长期边界

当前 draft 由 manager 生成，再流入 automation。这条链已经成立，但后续还需要继续明确：

- draft 是否长期作为 manager 与 automation 之间的唯一桥
- automation job 执行结果是否需要反向补充 manager memory / summary
- recurring rule 的上下文快照应落在哪一层

## 9. 下一阶段不建议过早展开的议题

为了避免架构讨论发散，下面这些事情当前不建议过早推动：

### 9.1 不建议过早讨论任意运行时代码热加载

当前 runtime contract 刚稳定，直接进入“在线下载 pack 代码并执行”会引入远大于现阶段收益的复杂度。

### 9.2 不建议把 bridge 层一次性删光

虽然桥接层最终要缩，但如果没有先清点依赖调用方，硬删会把现有主链重新打散。正确做法是逐步收口。

### 9.3 不建议为了通用化而把 UI 抽成空壳

多领域扩展的目标是让共享骨架更稳，而不是把所有领域细节都提前抽成没有实际语义的“万能组件”。

## 10. 当前代码锚点

如果团队要继续围绕现状讨论，下面这些文件是最值得对照着看的架构锚点：

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

## 11. 现阶段结论

当前客户端 2.0 的主架构已经基本立住：

- App Shell 管全局生命周期
- Command Center 管任务理解与会话编排
- Manager Gateway 管 session / context / run / persistence
- MatchDetail + AnalysisContext 管具体分析执行
- Automation Runtime 管后台调度与恢复
- Domain Runtime Pack 管领域语义与数据源接入

接下来真正值得做的，不是推翻这套主链，而是：

1. 继续缩桥接层
2. 继续做 subject 通用化
3. 用第二个 pack 验证合同
4. 在合同稳定后，再谈更强的 pack 级扩展能力

这应该作为当前客户端 2.0 后续讨论的共同起点。
