# 客户端 2.0 下一阶段路线图：桥接层收缩、Subject 通用化、第二 Runtime Pack 与 Automation-Manager 边界

日期: 2026-03-12
适用范围: 当前 `main` 工作区中的客户端 2.0 实现
关联文档:
- `docs/client/39-client-2.0-current-architecture-lifecycle-and-design-route-2026-03-12.md`
- `docs/client/40-client-2.0-architecture-review-core-transition-and-next-phase-2026-03-12.md`
- `docs/plans/2026-03-12-manager-2.0-cleanup-next-phase-plan.md`

## 1. 文档目的

这份文档承接 40 号文档里的架构复盘，继续把下一阶段最重要的 4 个议题展开成可以指导实施的路线图：

1. 过渡桥接层如何继续收缩
2. Subject 页如何继续从 football 语义走向 domain-neutral
3. 第二个 Runtime Pack 应该如何引入
4. Automation Runtime 与 Manager 的长期边界如何稳定

目标不是做一份空泛路线图，而是把每个议题的现状、目标状态、推荐方案、分阶段落地方式、风险与验收标准写清楚，让后续实现计划可以直接基于这份文档拆任务。

## 2. 全局判断与推荐顺序

先给出结论，避免后面的细节失焦。

### 2.1 四个议题的优先级

推荐优先级如下：

1. 先收缩桥接层
2. 再做 Subject 通用化骨架
3. 再引入第二个 Runtime Pack 作为合同压力测试
4. 最后再稳定 Automation-Manager 的长期边界

### 2.2 为什么是这个顺序

原因很直接：

- 如果桥接层还没有继续收口，系统仍然会保留“双入口”和“旧 shape 回流”的隐患，任何通用化工作都容易建立在临时接口上。
- 如果 Subject 页仍然深度绑定 `Match / MatchAnalysis` 语义，第二个 pack 引入后会被迫同时处理 UI 抽象和 runtime 合同问题，调试成本会翻倍。
- 第二个 pack 的价值不是加功能，而是验证合同；合同如果还没围绕第一个 pack 跑顺，过早引入第二个 pack 只会让问题来源变得模糊。
- Automation 与 Manager 的长期边界必须建立在前 3 点已经清晰的前提下，否则讨论很容易停留在“消息该回哪儿”“结果该写哪儿”的局部争论里。

### 2.3 不推荐的替代方案

当前不推荐以下两种路线：

- 大爆炸重写：直接删除 bridge 层、重写 Command Center 和 MatchDetail 的调用链。这会破坏当前已经验证通过的 2.0 主链。
- 为了多领域而过度抽象：过早把 Subject 页、ResultPanel、Export、History 统一成没有实际语义的万能组件。这会制造抽象空壳，而不是稳定骨架。

推荐路线仍然是：

`先缩边界 -> 再抽骨架 -> 再用第二个 pack 验证 -> 最后稳定系统级协作`

## 3. 议题一：桥接层收缩

## 3.1 当前现状

当前 bridge 层主要集中在以下 3 处：

- `src/services/manager-gateway/compatActions.ts`
- `src/services/manager/runtime.ts`
- `src/services/manager-gateway/legacyCompat.ts`

具体情况如下：

### 3.1.1 compatActions 当前作用

`useCommandCenterState.ts` 现在并不是直接调用 gateway，而是通过 `compatActions.ts` 调一层 gateway-backed action facade。

这层做了两件事：

- 把 UI 输入参数整理成当前 gateway 可接受的调用格式
- 把 action 的返回值统一整理成 UI 易用的结果对象

这说明：

- 它已经不再持有业务真相
- 但它仍然是 UI 与 gateway 之间的一道中间层

### 3.1.2 manager/runtime.ts 当前作用

`manager/runtime.ts` 还在承担：

- `submitManagerTurn`
- `syncManagerConversationWithDrafts`
- `submitManagerClarificationAnswer`
- `submitManagerDraftActivation`
- `submitManagerDraftDeletion`

它的本质已经不是“运行时主真相层”，而更像：

- gateway 结果 -> legacy session snapshot 的组装器
- automation draft store 与 manager 对话之间的桥接器
- 旧 manager session result shape 的适配层

### 3.1.3 legacyCompat 当前作用

`legacyCompat.ts` 负责把 `ManagerSessionProjection` 再投影成旧的 `ManagerSessionSnapshot`：

- `feed block -> legacy message`
- `activeWorkflow -> pendingTask`

这说明系统中仍然存在依赖旧 snapshot shape 的调用路径。

## 3.2 目标状态

桥接层的目标不是“全部删除”，而是收敛成“边界清晰、只做临时适配、没有业务分叉”。

目标状态应该是：

1. Command Center 直接面向 `ManagerSessionProjection + gateway action contract`
2. `manager/runtime.ts` 不再承载 legacy session snapshot 输出
3. `legacyCompat.ts` 只留给极少数必须兼容的调用方，且不再作为默认路径
4. manager 的核心主链只有一个真相入口：`manager-gateway/gateway.ts`

一句话说：

`桥接层可以存在，但不能再成为主路径。`

## 3.3 可选方案对比

### 方案 A：一次性删掉 bridge 层

优点：

- 最干净
- 代码表面最短

缺点：

- 风险极高
- 需要同时改 Command Center、automation draft 同步、legacy snapshot 消费方
- 很容易把当前稳定回归链打散

结论：当前不推荐。

### 方案 B：保持 bridge 层长期存在

优点：

- 风险最低
- 不会影响现有交互

缺点：

- 2.0 永远保留双语义模型
- projection 与 legacy snapshot 会长期并存
- 后续第二 pack 接入时仍会被旧 shape 污染

结论：也不推荐。

### 方案 C：逐层收缩，先把默认路径改成 projection-only

优点：

- 风险可控
- 每一步都能测回归
- 能逐步减少 legacy snapshot 消费方

缺点：

- 周期比方案 A 长
- 需要明确阶段边界和验收点

结论：推荐方案。

## 3.4 推荐实施路线

推荐拆成 3 个阶段：

### 阶段 1：UI 直接消费 projection-first action result

目标：

- 让 `useCommandCenterState.ts` 不再依赖 legacy session snapshot shape
- 将 `compatActions.ts` 的角色收窄成 gateway action helper，而不是 façade 主入口

建议动作：

- 为 gateway action 定义更稳定的 UI-facing contract
- 让 `useCommandCenterState.ts` 的核心状态只围绕 `projection` 运转
- 把 draft sync、turn submit、clarification、activation、deletion、cancel 都归一到 projection-first 返回值

### 阶段 2：manager/runtime.ts 从 legacy snapshot 中脱身

目标：

- `manager/runtime.ts` 不再默认生成 `ManagerSessionSnapshot`
- 把 draft store 与对话 feed 同步逻辑抽成更窄的 orchestration helper

建议动作：

- 拆分 gateway action orchestration 与 legacy snapshot mapping
- 优先让 `submitManagerTurn` 类接口回传 projection 或 gateway-native result
- 保留极薄的 legacy adapter 供旧调用方临时复用

### 阶段 3：legacyCompat 降级为边缘兼容模块

目标：

- `legacyCompat.ts` 不再出现在主交互链上
- 只给明确列出的旧消费者保留

建议动作：

- 列清楚旧 snapshot 的剩余调用方
- 将测试从“legacy shape 是默认输出”改为“legacy shape 仍可按需派生”
- 最终把 `projectManagerSessionProjectionToLegacySnapshot` 标记成 transitional API

## 3.5 风险与应对

风险：

- Command Center UI 行为看似没变，但轮询、draft bundle、run cancel 可能出现投影不同步
- legacy pendingTask 语义仍可能被 planner / tool registry 间接依赖

应对：

- 所有 bridge 收缩都必须先补 focused tests
- 每一步都跑 `managerRuntime`、`managerSessionStore`、`managerGatewayCompatActions`、`feedAdapter` 回归
- 在主链之外才允许使用 legacy snapshot

## 3.6 验收标准

- Command Center 的主数据流不再依赖 legacy snapshot
- `compatActions.ts` 不再承担会话真相拼装职责
- `manager/runtime.ts` 可以继续存在，但职责缩小到 orchestration helper
- `legacyCompat.ts` 不再是默认路径

## 4. 议题二：Subject 通用化

## 4.1 当前现状

虽然页面路由已经是 `/subject/:domainId/:subjectId`，但执行页内部仍有明显 football / match 语义残留，主要体现在：

- `src/pages/MatchDetail.tsx` 文件名和组件名仍是 Match 语义
- `useAnalysisRuntime.ts` 使用 `Match`、`MatchAnalysis`、`MatchAnalysisStep`
- `executionRuntime.ts` 仍以 `Match` 作为主要执行对象
- `AnalysisResultPanel`、`exportReportPdf` 等仍围绕 match analysis 结构设计
- `history.ts`、`ai.ts` 等领域中间层仍大量使用 `MatchAnalysis`

当前状态说明：

- 路由级别已经 subject 化
- 但执行与展示级别仍是 match-first

## 4.2 目标状态

目标不是把所有名字都立刻改成 “SubjectEverything”，而是建立真正的“双层结构”：

1. 通用 Subject Shell
2. 领域 Presenter / Formatter / Exporter / Input Model

换句话说，Subject 通用化的正确方向不是“把 football 细节抹掉”，而是把它放到正确的层。

目标状态应该是：

- 页面壳只知道自己在处理一个 `subject`
- 领域 pack 负责告诉 UI 如何展示 header、summary hero、result cards、export blocks
- 执行运行时只依赖 `AnalysisSubjectRef + domainId + subjectSnapshot`
- `MatchAnalysis` 不再作为整个执行系统的默认公共语义

## 4.3 可选方案对比

### 方案 A：直接重命名 MatchDetail 和相关类型

优点：

- 表面上最直接

缺点：

- 只是改名字，不等于完成边界迁移
- 如果底层数据结构没拆，第二个 pack 进来还是会撞墙

结论：单独使用时不推荐。

### 方案 B：先抽通用 shell，再渐进替换内部语义

优点：

- 最符合当前代码结构
- 可以保留 football presenter 的现有实现
- 风险可控

缺点：

- 需要在一段时间内接受“文件名和通用语义并存”

结论：推荐方案。

### 方案 C：先等第二个 pack 再做 subject 通用化

优点：

- 可以更快看到第二领域效果

缺点：

- 第二个 pack 会在不通用的 Subject 页里接入，导致验证噪声过大

结论：不推荐。

## 4.4 推荐实施路线

推荐拆成 3 层推进：

### 层 1：先抽类型和执行输入的通用接口

目标：

- 把执行链上的 domain-neutral 最小实体单独立起来

建议动作：

- 将 `MatchAnalysisStep` 改造成更通用的 `SubjectAnalysisStep`
- 为执行态明确区分：
  - `subjectRef`
  - `subjectSnapshot`
  - `subjectDisplay`
  - `domainSummary`
- 逐步减少 `MatchAnalysis` 在 execution core 中的直接暴露

### 层 2：把页面壳与 presenter 彻底分层

目标：

- 让 Subject 页负责生命周期和布局
- 让 domain presenter 负责领域具体展示

建议动作：

- 收敛 `MatchDetail.tsx` 中的 football-specific header / hero / export / summary assumptions
- 继续下沉到 `services/domains/ui/*` 或 domain pack presenter
- 把 PDF 导出和结果面板输入改成 subject-neutral envelope + presenter context

### 层 3：让 history / resume 数据结构更偏 subject

目标：

- 历史记录与 resume 状态不再默认假设“分析对象一定是 match”

建议动作：

- 把保存历史时的 `subjectDisplay` / `subjectSnapshot` 使用方式继续统一
- 检查 `history.ts`、`savedSubjects.ts`、`analysisOutputEnvelope` 的字段命名
- 保持已有数据兼容，但新路径优先走 subject-neutral contract

## 4.5 风险与应对

风险：

- 过早通用化会造成 UI 大量抽象代码但没有第二领域验证
- `MatchAnalysis` 仍被许多 presenter 与历史逻辑使用，改动范围可能扩散

应对：

- 先只改 execution shell 和 contracts，不同时大改所有 presenter
- 保留 football presenter 作为第一个 domain implementation
- 通过 `useAnalysisRuntime`、`historyResumeRecoverability`、`MatchDetail` focused tests 控制回归

## 4.6 验收标准

- 页面生命周期、恢复逻辑、执行入口不再强依赖 `Match` 语义
- presenter、export、summary 能清晰区分通用壳与领域实现
- 引入第二个 pack 时，不需要复制一份新的 `MatchDetail`

## 5. 议题三：第二个 Runtime Pack

## 5.1 当前现状

当前 runtime contract 已经具备：

- `manifest`
- `resolver`
- `sourceAdapters`
- `contextProviders`
- `tools`
- `workflows`
- `memoryPolicy`
- `queryCatalog`

但真实运行层仍然是：

- builtin registry 只注册了 football
- installed pack 目前主要是 alias / metadata 层
- manager、context assembler、domain query 都是在 football pack 上被验证出来的

所以当前最大的问题不是“没有第二个 pack”，而是“合同还没有被第二个 pack 压力测试”。

## 5.2 第二个 pack 的目标定位

第二个 pack 的目标不应该是“尽快上线一个新业务”，而应该是：

`用一个与 football 语义不同、但复杂度适中的新 pack，验证当前 runtime contract 是否真的 domain-neutral。`

它应该帮助回答：

- resolver 是否真的不依赖 football event 结构
- source adapter / query catalog 是否足够通用
- context assembler 是否只消费 canonical fragments
- manager workflow resume 是否能围绕 domain workflowType 运转
- Subject 页与历史恢复是否能承接新的 subjectSnapshot

## 5.3 第二个 pack 的选择原则

不建议选太重的领域，也不建议选太简单的领域。

推荐特征：

- 有明确事件列表或主题列表
- 有单主题分析对象
- 能复用现有 `query -> select subject -> analyze -> history` 主链
- 不要求一开始就有复杂动画或多媒体输出

不推荐一上来做：

- 需要完全不同执行引擎的领域
- 需要复杂实时流、交易状态、账户安全的领域
- 需要服务端大改配合的领域

### 推荐方案

优先选择一个“结构上像 football，但语义不同”的轻中量 pack 作为合同验证 pack。

原因：

- 可以最大化复用当前 Subject、history、automation、manager 主链
- 可以让问题集中暴露在 contract，而不是基础设施

## 5.4 推荐实施路线

### 阶段 1：先做 pack scaffold，不急于做 UI 花活

目标：

- 先证明 registry、sourceAdapters、contextProviders、tools、workflows 能挂上第二个 pack

建议动作：

- 新建 runtime pack scaffold
- 实现最小 resolver
- 实现最小 source adapter
- 实现至少一个 query tool 和一个 analyze flow
- 让 registry 可以列出该 pack，并正确 resolve

### 阶段 2：接通 subject route 与 history/resume

目标：

- 第二个 pack 能走：
  - query / resolve subject
  - navigate to `/subject/:domainId/:subjectId`
  - run analysis
  - save history
  - recover result

### 阶段 3：验证 automation draft 与 recurring path

目标：

- 第二个 pack 能经由 manager 生成 draft
- draft 能转成 run_now 或 save_only
- automation 能调度它的 job/rule

## 5.5 风险与应对

风险：

- 第二个 pack 一上来就试图复刻 football 的全部能力，导致范围膨胀
- 团队把它当产品功能线，而不是合同验证线

应对：

- 明确第二 pack 的成功标准是“验证 contract”，不是“做全量体验”
- 限制第一阶段只做最小闭环，不做额外 fancy UI

## 5.6 验收标准

- runtime registry 可稳定 resolve 第二 pack
- manager context assembly 不需要为第二 pack 增加 football-specific 分支
- Subject 页、history、resume、automation 至少能跑通最小闭环

## 6. 议题四：Automation 与 Manager 的长期边界

## 6.1 当前现状

当前链路已经比较清晰：

- Manager 负责理解自然语言意图
- Manager 生成或更新 automation draft
- draft 激活后：
  - `run_now` 走 MatchDetail
  - `save_only` 走 automation activation
- Automation Runtime 负责 rule/job/run 的后台调度与恢复

当前仍未完全定型的点主要有：

- draft 是否是 manager 与 automation 之间唯一稳定的桥
- automation job/run 的结果是否需要回写 manager memory / summary
- recurring rule 的上下文快照该放在哪一层
- manager conversation 是否要消费 automation 运行结果反馈

## 6.2 目标状态

目标不是让 manager 和 automation 完全隔离，而是让它们通过一条稳定契约协作。

推荐目标状态：

1. `draft` 作为 manager -> automation 的唯一建模桥
2. `rule/job/run` 作为 automation 侧唯一执行真相
3. manager 默认不直接持有 automation job 执行状态
4. automation 执行结果通过“摘要化事件”回流 manager，而不是直接把 run store 混入 manager session

这意味着：

- manager 负责“理解与安排”
- automation 负责“计划与执行”
- 两者通过 draft 和摘要化反馈协作，而不是共享内部状态对象

## 6.3 可选方案对比

### 方案 A：manager 直接持有 automation 全量状态

优点：

- 看起来交互更统一

缺点：

- manager session 会变成自动化运行仓库
- 会把后台调度细节污染到聊天模型

结论：不推荐。

### 方案 B：automation 与 manager 完全断开

优点：

- 边界非常硬

缺点：

- 用户在聊天里创建任务后，看不到后续闭环
- manager memory 和 user intent 难以演进

结论：也不推荐。

### 方案 C：draft 作为唯一桥，结果以摘要事件回流

优点：

- 职责清晰
- 数据边界稳定
- 对用户仍能形成闭环

缺点：

- 需要额外定义结果摘要回流 contract

结论：推荐方案。

## 6.4 推荐实施路线

### 阶段 1：明确 draft contract 不扩散

目标：

- 避免 manager 直接依赖 job/rule/run store shape

建议动作：

- 文档化 draft 的字段边界
- 在 manager 侧只关心 draft 是否 ready、clarify、run_now、save_only
- job/rule/run 生成与持久化全放在 automation 侧

### 阶段 2：定义 automation result summary 回流 contract

目标：

- automation 执行完成后，可选择给 manager 写入轻量摘要，而不是全量运行状态

建议动作：

- 设计 `automation_outcome_summary` 之类的 summary/memory write contract
- 只回流：
  - 哪个任务完成了
  - 哪个主题被分析了
  - 结果是否成功 / 失败 / 需要人工处理

### 阶段 3：明确 recurring rule 的上下文归属

目标：

- recurring rule 的模板和执行策略留在 automation
- manager 只保留用户意图层摘要

建议动作：

- 不把 recurring rule 全量上下文塞进 manager session
- 若需要回流，只回流 human-readable summary 或 memory key

## 6.5 风险与应对

风险：

- 为了“对话统一感”把 automation 运行态硬塞进 manager
- 或者反过来因为怕耦合而彻底不回流，导致用户失去闭环感

应对：

- 坚持 full state 不回流，只回流摘要和记忆
- 保持 draft / rule / job / run 的职责链清晰

## 6.6 验收标准

- draft 成为 manager -> automation 的唯一主桥
- automation 执行状态不直接污染 manager session store
- 可以通过摘要化结果让 manager 对长期任务保持基本记忆

## 7. 推荐执行路线图

基于上面 4 个议题，推荐把后续开发拆成 3 个阶段：

### Phase A：收口主边界

目标：

- 收缩 bridge 层
- 做 Subject 通用化骨架

这是下一步最值得马上开始的开发阶段。

### Phase B：验证合同

目标：

- 引入第二个 runtime pack 的最小闭环
- 用第二个 pack 验证 registry、context、history、automation 的 domain-neutral 程度

### Phase C：稳定系统协作

目标：

- 让 Automation 与 Manager 的结果回流 contract 稳定下来
- 再决定是否要继续开放更强的 pack 级扩展

## 8. 推荐的下一步开发切片

如果要在下一轮开发里只选一个最值得做的切片，推荐选：

`Phase A.1：桥接层收缩 + Subject 通用化最小骨架`

原因：

- 这一步风险最低
- 对现有主链收益最大
- 它能直接降低第二个 pack 接入时的噪声
- 它不会引入新的业务复杂度

建议这一轮只做两件事：

1. 让 Command Center 的主交互链进一步 projection-first，压缩 bridge 层默认路径
2. 把 `MatchDetail/useAnalysisRuntime/executionRuntime` 里最核心的 match-first 类型和步骤名收敛成 subject-neutral contract

## 9. 结论

当前客户端 2.0 的下一阶段，不应该理解为“继续大重构”，而应该理解为：

`在已经成立的 2.0 主骨架上，继续把过渡边界缩小，并为第二个 pack 的合同验证清出一条干净路径。`

所以推荐路线是：

1. 先缩 bridge
2. 再抽 subject shell
3. 再引入第二个 pack
4. 最后稳定 automation-manager 长期边界

这条顺序兼顾了风险、收益和验证价值，适合作为接下来一轮到两轮客户端开发的共同路线。
