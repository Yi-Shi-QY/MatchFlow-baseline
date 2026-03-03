# 26. Client Optimization Refactor & Server Alignment (2026-03-03)

## 0. 文档目的

本文用于同步 **2026-03-03 当天客户端（`MatchFlow/src`）的优化重构**，让服务端团队快速理解：

1. 我们的目标是什么
2. 我们做了什么
3. 为什么这样做
4. 与之前的关键差异
5. 服务端应如何对应调整

说明：
- 本文聚焦客户端代码与客户端-服务端契约影响。
- 当天按决策要求，服务端代码已回退，本文不包含服务端已落地改动。

---

## 1. 本轮目标与边界

### 1.1 目标

1. 把客户端从“足球单场景”演进到“多分析领域可扩展框架”。
2. 降低设置复杂度，支持基础模式下直接切换分析领域。
3. 修复已发现的关键交互缺陷（设置页下拉遮挡）。
4. 强化本地领域测试可用性（新增领域必须带最少案例）。
5. 将最终结论展示从“足球胜率硬编码”升级为“通用结论结构”。
6. 修复分析中返回异常（`Match not found`）并增强持久化恢复可靠性。

### 1.2 非目标

1. 本轮不改服务端代码实现。
2. 不做破坏性迁移，旧足球链路保持兼容可用。
3. 不在本轮彻底替换 `Match` 结构（仍保留双边比赛模型兼容层）。

---

## 2. 关键改动总览（按模块）

## 2.1 领域框架重构：内建领域模块化、统一注册、可校验

### 改动

新增 `src/services/domains/builtinModules.ts`，把内建领域聚合为统一模块：

- `domain`
- `planningStrategy`
- `localTestCases`

并提供能力：
- `listBuiltinDomains()`
- `listBuiltinPlanningStrategies()`
- `getBuiltinDomainLocalTestCases(domainId)`
- `findBuiltinDomainLocalTestCaseById(matchId)`（用于恢复场景）

新增约束校验：
- 每个内建领域 `localTestCases` 数量必须 >= 3
- 案例 ID 非空且唯一
- 领域与规划策略 `domainId` 必须一致

### 原因

之前领域、规划、样例数据分散，扩展新领域成本高且容易漏配。  
统一成模块后，新增领域具备可检查、可运行、可回退的最小交付包。

### 影响文件

- `src/services/domains/builtinModules.ts`
- `src/services/domains/registry.ts`
- `src/services/domains/planning/registry.ts`

---

## 2.2 新增篮球领域（独立 Domain + Planning）

### 改动

新增篮球领域定义：
- `src/services/domains/basketball.ts`

新增篮球规划策略：
- `src/services/domains/planning/basketball.ts`

并在 `builtinModules` 中注册篮球领域及 3 条本地案例数据（`b1/b2/b3`）。

### 原因

用真实“第二领域”验证框架可扩展性，而不是停留在抽象接口层。

### 关键点

1. 篮球领域拥有独立的数据源配置和可用性判断逻辑。
2. 篮球规划策略独立于足球规则，避免足球逻辑污染。
3. 本地案例满足“至少 3 条”测试要求，支持无服务端依赖调试。

---

## 2.3 领域与规划注册逻辑去足球硬编码

### 改动

领域注册从固定 `football` 改为读取 `builtinModules` 动态构建。  
规划策略注册同理，默认策略也从“固定足球”升级为“配置默认 + 首项兜底”。

并将 `TemplateType` 从足球专属联合类型放宽为 `string`：
- `src/services/ai/planning.ts`

### 原因

之前新增非足球模板会被类型层阻塞。放宽后可让多领域策略独立定义模板名。

### 影响文件

- `src/services/domains/registry.ts`
- `src/services/domains/planning/registry.ts`
- `src/services/ai/planning.ts`

---

## 2.4 设置页优化：基础模式可直接切领域 + 健康检查 + 下拉层级修复

### 改动

设置页新增：
1. `Basic / Advanced` 模式切换
2. 系统状态卡片（AI/Data/Extensions/Background）
3. 一键健康检查（并行检测 AI 和数据源）
4. 基础模式直接显示“分析领域”选择器
5. 高级项（扩展白名单、自主规划等）收纳到高级模式

下拉遮挡修复：
- `Select` 组件改为 `Portal + fixed` 定位渲染到 `document.body`
- 增加滚动/尺寸重算、跨容器 outside click 处理

### 原因

1. 设置项变多后，单层平铺难以维护与使用。
2. 移动端叠层中，下拉易被后续控件遮挡，影响关键设置操作。

### 影响文件

- `src/pages/Settings.tsx`
- `src/components/ui/Select.tsx`

---

## 2.5 首页与详情页领域感知增强

### 改动

首页数据回退策略调整：
- 之前：服务端失败 -> 固定 `MOCK_MATCHES`（足球）
- 现在：服务端失败 -> 当前激活领域本地案例 -> 最后才足球 mock

历史卡片结论条形图改为通用分布（不再硬依赖 `winProbability.home/draw/away`）。

详情页领域实例获取修正：
- 去掉 `useMemo([])` 的一次性缓存，避免切换领域后继续使用旧领域对象。

### 原因

1. 修复“切换领域后首页还是足球”的感知错误。
2. 为非足球结论展示铺路（首页历史卡片可渲染通用分布）。

### 影响文件

- `src/pages/Home.tsx`
- `src/pages/MatchDetail.tsx`

---

## 2.6 最终结论通用化：从足球胜率卡片升级为通用结论结构

### 改动

`MatchAnalysis` 扩展为通用结构（兼容旧字段）：

- 新增 `outcomeDistribution[]`：通用结果分布
- 新增 `conclusionCards[]`：通用结论卡
- 保留 `winProbability`、`expectedGoals` 作为兼容字段

新增归一化工具：
- `src/services/analysisSummary.ts`
  - 优先读取 `outcomeDistribution`
  - 无新字段时回退旧 `winProbability`
  - 做数值清洗与百分比分布归一化

summary agent 提示词改造：
- 从“资深足球分析师”改为“通用数据分析总结”
- 明确输出 `outcomeDistribution` / `conclusionCards`
- 旧字段改为可选项，仅在双边体育场景下输出

UI 与导出同步改造：
- 详情页最终摘要卡片支持通用分布与通用结论卡
- PDF 导出增加“结果分布/结论卡片”输出路径

### 原因

之前最终结论呈现强绑定足球对阵模型，无法承载股票等单标的或多情景分析。

### 影响文件

- `src/services/ai.ts`
- `src/services/analysisSummary.ts`
- `src/agents/summary.ts`
- `src/pages/MatchDetail.tsx`
- `src/pages/Home.tsx`

---

## 2.7 持久化策略增强与“Match not found”修复

### 现象

复现路径：
- 切换篮球领域 -> 开始分析 -> 返回首页 -> 点历史卡片回详情
- 偶发进入 `Match not found`

### 根因

1. 详情页匹配 `match` 的来源链路对“分析中对象”支持不足。
2. 异步上下文加载前直接判空显示 `Match not found`。
3. Resume state 未携带 `match` 快照，弱网/切页时恢复能力不足。

### 改动

1. 详情页 `match` 解析链路改为：

`routeActiveAnalysis.match -> history.match -> saved.match -> resume.matchSnapshot -> builtinLocalCase -> MOCK_MATCHES`

2. 在上下文加载期显示 loading，而非立即报 not found。
3. `AnalysisResumeState` 新增 `matchSnapshot`。
4. 分析过程持久化时写入 `matchSnapshot`。
5. 新增 `findBuiltinDomainLocalTestCaseById` 用于本地领域样例恢复。

### 影响文件

- `src/pages/MatchDetail.tsx`
- `src/contexts/AnalysisContext.tsx`
- `src/services/ai.ts`
- `src/services/domains/builtinModules.ts`

---

## 3. 前后差异（Before / After）

| 主题 | Before | After |
|---|---|---|
| 领域注册 | 足球硬编码主路径 | 内建领域模块化注册，支持多领域 |
| 新增领域门槛 | 分散改动，易漏 | `builtinModules` 一处接入 + 校验 |
| 本地测试样例 | 无统一约束 | 强制每领域至少 3 条且 ID 合法 |
| 领域切换可见性 | 设置深层且复杂 | 基础模式可直接切换分析领域 |
| 下拉层级 | 易被覆盖遮挡 | Portal + fixed + outside click |
| 首页回退数据 | 固定足球 mock | 按 activeDomain 回退本地案例 |
| 最终摘要展示 | 仅主/平/客胜率 | 通用分布 + 通用结论卡 + 兼容旧字段 |
| 持久化恢复 | 仅 plan/thoughts | 增加 `matchSnapshot`，恢复链路更稳 |

---

## 4. 对服务端团队的契约影响与建议改造

## 4.1 当前客户端已消费的服务端接口

1. `GET /matches`
2. `GET /analysis/config/match/:matchId`
3. `POST /analysis/config/resolve`

## 4.2 建议服务端对齐方向

### A. 域感知（Domain-aware）返回

建议 `GET /matches` 支持按领域筛选（例如 query `domainId`），并返回可直接映射到客户端领域的数据。

最低建议字段：
- `id`
- `league` 或更通用分类字段
- `status`
- `date`
- `source`
- `capabilities`（`hasStats/hasOdds/hasCustom`）

兼容期可继续返回旧比赛结构，但请避免仅足球语义。

### B. 规划配置接口透传与兼容

`/analysis/config/*` 返回建议稳定提供：

```json
{
  "data": {
    "sourceContext": {
      "domainId": "basketball",
      "selectedSources": { "context": true, "market": false },
      "selectedSourceIds": ["context"],
      "capabilities": { "hasFundamental": true, "hasStats": true, "hasOdds": false, "hasCustom": false },
      "planning": {
        "mode": "template",
        "templateType": "standard"
      }
    }
  }
}
```

关键要求：
1. 不要假设 domain 只有 football。
2. 对未知字段做透传兼容，不要硬裁剪。
3. `planning.templateType` 不要限制为足球枚举，客户端已改为 `string`。

### C. 历史/恢复协同（可选增强）

客户端已做本地 `matchSnapshot` 持久化。  
若服务端后续接管分析任务状态，建议提供：

1. `analysis job` 查询接口（按 `matchId` / `jobId`）
2. 最近一次输入快照读取接口
3. 结果摘要结构支持通用字段：
   - `prediction`
   - `keyFactors`
   - `outcomeDistribution[]`
   - `conclusionCards[]`
   - （可选）旧 `winProbability` 兼容字段

---

## 5. 本轮服务端无需立即改动项（已约束）

1. 本轮客户端已保证在服务端不变情况下可运行（通过本地样例与兼容链路）。
2. 当天已按要求回退服务端实验性改动。
3. 客户端保留了旧字段兼容路径，避免联调阻塞。

---

## 6. 联调建议清单（给客户端 + 服务端）

1. 切换领域后首页回退数据是否跟随领域。
2. 篮球分析中途返回首页再回详情，是否仍可恢复上下文。
3. `/analysis/config/resolve` 返回自定义 `templateType` 时是否正确进入规划。
4. summary 输出若无 `winProbability`，详情页与首页是否仍能渲染通用结论。
5. PDF 导出是否包含“结果分布 + 结论卡片”。

---

## 7. 后续建议（下一阶段）

1. 将核心输入模型从 `Match` 进一步抽象为 `AnalysisEntity`（彻底脱离主客队语义）。
2. 服务端 `matches` 接口改为领域可配置实体列表接口（不局限体育对阵）。
3. 分享页与历史卡片从 `home/away` 文案迁移到领域可配置标题字段。

---

## 8. 变更文件索引（本轮核心）

- `src/services/domains/builtinModules.ts`
- `src/services/domains/basketball.ts`
- `src/services/domains/planning/basketball.ts`
- `src/services/domains/registry.ts`
- `src/services/domains/planning/registry.ts`
- `src/services/ai/planning.ts`
- `src/pages/Settings.tsx`
- `src/components/ui/Select.tsx`
- `src/pages/Home.tsx`
- `src/services/ai.ts`
- `src/agents/summary.ts`
- `src/services/analysisSummary.ts`
- `src/pages/MatchDetail.tsx`
- `src/contexts/AnalysisContext.tsx`

