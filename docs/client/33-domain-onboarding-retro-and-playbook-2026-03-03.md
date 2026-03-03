# 客户端新增领域复盘与操作手册（2026-03-03）

## 1. 文档目标

本文面向 `MatchFlow/src` 客户端团队，解决两件事：

1. 回顾我们三次“新增领域/领域重构”的关键经验。
2. 给出当前版本可直接执行的“新增独立分析领域”操作手册和上线门槛。

注意：本文不要求修改服务端代码，但会给出客户端对服务端的协作清单。

---

## 2. 三次新增领域实践复盘

### 2.1 第一次：篮球领域接入（从单一足球到多领域）

**做对的部分**

1. 建立了内置领域模块结构：`domain + planning + localCases + module`。
2. 打通了领域注册链路，支持在设置页选择并切换领域。
3. 形成了篮球独立模板与 agent（不再仅靠足球模板驱动）。

**暴露的问题**

1. 首版仍保留较多“比赛语义”默认值，影响通用化定位。
2. 首页和历史卡片存在偏体育化展示习惯，不足以承载通用分析场景。
3. i18n 完整性不够，存在硬编码文案。

**经验结论**

1. 新领域不只是“能跑分析”，还要“展示语义正确”。
2. 领域抽象要同时覆盖：数据源、规划、展示、文案。

---

### 2.2 第二次：股票领域首版接入（从体育数据结构走向通用分析结构）

**做对的部分**

1. 股票领域定义了独立数据源组：
`asset_profile / macro_regime / price_action / valuation_health / risk_events`。
2. 规划策略实现了按数据能力信号路由模板（`basic / standard / risk_focused / comprehensive`）。
3. 本地案例可用于无服务端依赖的端到端演示。

**暴露的问题**

1. 局部仍沿用了比赛式结构壳，通用平台定位不够鲜明。
2. 股票 i18n 覆盖不完整，部分字段和描述是硬编码。
3. 动画模板存在复用体育模板的问题，领域差异不够明显。

**经验结论**

1. 新领域要优先定义“原生语义数据结构”，再做兼容层。
2. 模板、动画、agent 需要领域化命名与语义，不应借用旧领域词汇。

---

### 2.3 第三次：股票领域通用化升级（架构层完善）

**做对的部分**

1. 引入首页领域 presenter 层（`src/services/domains/home/presenter.ts`），让首页可按领域切换模板。
2. 完成股票领域 i18n key 化（数据源、字段、首页文案、状态文案等）。
3. 股票动画链路改为专用类型与模板：
   `stocks_price_structure / stocks_valuation_health / stocks_risk_radar`。
4. 内置领域统一执行“本地案例最少 3 条”的启动校验。

**解决的关键问题**

1. 首页不再固定为“热门赛事/VS/直播中”等体育语义。
2. 股票规划模板、自治规划提示词、动画模板三层语义对齐。
3. 领域扩展从“页面分支硬编码”转为“模块化注册 + presenter 渲染”。

**经验结论**

1. 新领域上线必须同时满足三条链路：
   分析链路、展示链路、语言链路。
2. 领域差异应收敛在模块和配置层，避免在页面中散落 `if domain === ...`。

---

## 3. 当前版本领域框架总览（截至 2026-03-03）

### 3.1 核心目录

1. 领域模块：`src/services/domains/modules/<domainId>/`
2. 内置模块注册：`src/services/domains/builtinModules.ts`
3. 领域运行时查询：`src/services/domains/registry.ts`
4. 领域规划策略：`src/services/domains/planning/registry.ts`
5. 领域 agent：`src/agents/domains/<domainId>/`
6. 领域 planner 模板：`src/skills/planner/templates/<domainId>/`
7. 首页领域展示策略：`src/services/domains/home/presenter.ts`
8. 动画模板与映射：
   `src/services/remotion/templates.tsx` +
   `src/services/remotion/templateParams.ts`

### 3.2 内置校验（上线前最关键）

在 `src/services/domains/builtinModules.ts` 中，启动阶段会验证：

1. `domain.id` 唯一。
2. `planningStrategy.domainId` 与 `domain.id` 对齐。
3. `dataSources` 的 source id 不重复（重复会警告）。
4. 每个内置领域本地案例数量至少 3 条（不足直接抛错）。
5. 本地案例 id 非空且唯一（不满足直接抛错）。

这意味着“本地至少 3 条案例”已经是框架硬约束，不再是仅靠团队约定。

---

## 4. 新增领域操作手册（当前版本标准流程）

下面按可执行顺序给出新增 `<domainId>` 的标准步骤。

### Step 0：先定义领域语义契约

在编码前先明确：

1. 领域核心对象是谁（例如资产、事件、产品、项目等）。
2. 数据源组有哪些，字段语义是否原生。
3. 能力信号（capabilities）如何定义。
4. 最终结论输出形态是什么（不依赖“主客队胜率”等体育特定结构）。

输出建议：先写一个简版 domain brief（半页即可），再进入代码。

### Step 1：创建领域模块骨架

新增目录：`src/services/domains/modules/<domainId>/`

至少包含：

1. `domain.ts`
2. `planning.ts`
3. `localCases.ts`
4. `module.ts`
5. `index.ts`

`module.ts` 需产出 `BuiltinDomainModule`，封装 domain/planning/localCases 三件套。

### Step 2：实现 `domain.ts`

核心工作：

1. 声明 `AnalysisDomain` 基本信息：`id/name/description/resources`。
2. 定义 `DataSourceDefinition[]`（每个 source 的 apply/remove/formSections）。
3. 实现 `resolveSourceSelection()`。
4. 实现 `buildSourceCapabilities()`。

硬要求：

1. `labelKey/descriptionKey/titleKey/placeholderKey` 使用 i18n key。
2. source id 使用领域语义命名，不借用旧领域含义。
3. `resources.templates/animations/agents/skills` 全量声明，便于约束和审计。

### Step 3：实现 `planning.ts`

核心工作：

1. `resolveRoute(analysisData)`：决定 `template` 或 `autonomous` 路由。
2. `buildFallbackPlan(language)`：提供中英双语兜底结构。
3. `requiredTerminalAgentType`：强制最终结论 agent 存在。
4. 可选：`buildRequiredTerminalSegment(language)`，为终结段提供稳定兜底。

建议：

1. 路由逻辑尽量纯函数化，便于回归测试。
2. “数据不足”要降级，不要直接失败。

### Step 4：准备本地案例（必须 >= 3）

在 `localCases.ts` 中准备本地案例数据：

1. 至少 3 条，且 `id` 唯一、非空。
2. 建议覆盖 3 种状态或场景（如 `upcoming/live/finished` 或轻量/标准/完整）。
3. 建议覆盖不同数据能力组合（例如只风险、技术+估值、全量）。

说明：框架会在启动时校验，少于 3 条会阻止运行。

### Step 5：注册到内置模块系统

修改：

1. `src/services/domains/modules/index.ts` 导出新模块。
2. `src/services/domains/builtinModules.ts` 注入 `create<Domain>BuiltinModule(...)`。

完成后，`registry/planning registry` 会自动识别该内置领域。

### Step 6：新增领域 agent

新增目录：`src/agents/domains/<domainId>/`

至少包含：

1. `overview`
2. 分领域专用分析 agent（按业务需要）
3. `prediction`（终结段）
4. `general`（兜底）

并修改 `src/agents/index.ts`：

1. 注册 `BUILTIN_AGENTS`。
2. 注册 `BUILTIN_AGENT_VERSIONS`。

### Step 7：新增领域 planner 模板

新增目录：`src/skills/planner/templates/<domainId>/`

至少建议 3~4 套模板（如 basic/standard/focused/comprehensive）。

并修改：

1. `src/skills/planner/templates/<domainId>/index.ts` 导出模板。
2. `src/skills/planner/index.ts` 将模板加入 `BUILTIN_TEMPLATES`。

检查点：

1. `requiredAgents` 与 `segment.agentType` 都能在 agent 注册表找到。
2. `getSegments(isZh)` 必须真正使用 `isZh` 返回中英文。
3. 动画类型先用 `none` 也可，但不要使用错误领域语义。

### Step 8：接入 template/autonomous 规划提示词

修改：

1. `src/agents/planner_template.ts`
2. `src/agents/planner_autonomous.ts`

必须做的事：

1. 扩展 domain 识别逻辑（`resolvePlanningDomain`）。
2. 增加该领域模板集合选项。
3. 增加该领域可用 agentType 约束。
4. 如果有自定义动画类型，补充“动画映射规则”提示词（中英文）。

### Step 9：接入动画模板（可选但推荐）

如果领域需要可视化动画：

1. 在 `src/services/remotion/templates.tsx` 增加领域模板组件与 schema。
2. 在 `src/services/remotion/templateParams.ts` 中：
   - 增加 animation type。
   - 增加 type -> templateId 映射。
   - 增加 payload 校验规则。
   - 增加 fallback/prompt example 预填充逻辑。
3. 在 `domain.ts` 的 `resources.animations` 填入新模板 id。

目标：避免复用旧领域动画造成语义错位。

### Step 10：接入首页领域 presenter（当前版本必须）

修改：`src/services/domains/home/presenter.ts`

至少补齐：

1. `useRemoteFeed`
2. `sectionTitleKey/sectionHintKey/refreshActionKey/openActionKey/noDataKey/searchPlaceholderKey`
3. `getDisplayPair`
4. `getSearchTokens`
5. `getStatusLabel/getStatusClassName`
6. `getOutcomeLabels`
7. `getCenterDisplay`

否则首页会回退到旧领域展示语义，影响“通用分析平台”定位。

### Step 11：补齐 i18n

修改：

1. `src/i18n/locales/en.json`
2. `src/i18n/locales/zh.json`

建议至少覆盖：

1. `domains.<domainId>.name`
2. `home.*` 该领域相关文案
3. `<domainId>.sources.*`
4. `<domainId>.sections.*`
5. `<domainId>.fields.*`

硬要求：面向用户的字段标签、描述、占位符均走 key，不留硬编码文案。

### Step 12：验证持久化与回跳链路

重点验证：

1. 切换领域后首页数据源与展示语义同步。
2. 在新领域执行分析后，主页历史卡片可正常回跳详情页。
3. 中断分析 -> 恢复分析流程可用。
4. 本地案例 id 与历史记录 matchId 可互相定位，避免 `Match not found`。

---

## 5. 上线门槛（Definition of Done）

只有全部满足才允许标记“可上线”：

1. 结构完整：domain/planning/localCases/module/agents/templates/presenter/i18n 全部完成。
2. 启动校验通过：本地案例 >= 3 且 id 合法唯一。
3. 规划链路通过：模板路由、自治路由、终结段约束都有效。
4. 展示链路通过：首页、历史、详情页语义一致且领域化。
5. 动画链路通过（若启用动画）：type 映射、校验、渲染都正确。
6. 质量检查通过：`npm.cmd run lint` 与 `npm.cmd run build`。
7. 手工冒烟通过：切域、分析、回跳、导出、语言切换至少各验证一次。

---

## 6. 标准回归清单（建议直接复制到 PR）

1. 设置页切换到新领域后，首页标题、状态文案、卡片中心展示是否符合新领域语义。
2. 新领域 3 条本地案例均可打开并开始分析。
3. `includeAnimations=true/false` 两种模式都能跑通。
4. 历史记录卡片点击回跳详情页无异常。
5. 中英文切换后，页面文案、模板分段文案、表单字段文案都正确。
6. `npm.cmd run lint` 通过。
7. `npm.cmd run build` 通过。

---

## 7. 给服务端团队的最小协作清单（客户端视角）

即使本轮不改服务端，也建议提前同步：

1. 新领域 source groups 与 capabilities 字段定义。
2. 新领域模板 id / agent id / 动画 type 清单。
3. `sourceContext` 最低字段契约（domainId、selectedSources、capabilities 等）。
4. 至少 3 份示例 payload（轻量、标准、完整）用于联调与回归。

---

## 8. 总结

经过三轮实践，我们当前版本的新增领域流程已经从“功能可跑”升级为“可维护、可验证、可上线”：

1. 通过模块化注册保证结构一致性。
2. 通过本地案例硬校验保证测试基线。
3. 通过 presenter 和 i18n 保证展示语义一致性。
4. 通过规划与动画链路拆分保证领域专精与通用兼容并存。

按本文手册执行，新增一个独立分析领域可以做到“低返工、低风险、可审计上线”。
