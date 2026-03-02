# 24. Client Architecture Optimization (Client-Only) / 客户端架构优化总览（仅客户端）

## 0) Meta / 元信息

### EN
- Status: Active working draft (aligned with current codebase)
- Scope: Client-side architecture only (`src/`), excluding server implementation details
- Last updated: 2026-03-02
- Related docs:
  - `docs/02-architecture.md`
  - `docs/04-ai-agent-framework.md`
  - `docs/14-extension-hub-spec.md`
  - `docs/domain-packs.md`
  - `docs/skill-runtime-modes.md`

### ZH
- 状态：当前有效工作稿（已与现有代码对齐）
- 范围：仅客户端架构（`src/`），不包含服务端实现细节
- 最后更新：2026-03-02
- 关联文档：
  - `docs/02-architecture.md`
  - `docs/04-ai-agent-framework.md`
  - `docs/14-extension-hub-spec.md`
  - `docs/domain-packs.md`
  - `docs/skill-runtime-modes.md`

---

## 1) Why This Refactor / 为什么要做这轮重构

### EN
The previous client architecture was football-centric and increasingly hard to scale:
- Data source behaviors were tightly coupled to a single built-in domain.
- Planning logic and fallback behavior were hardcoded around football assumptions.
- Extension runtime was not expressive enough for dynamic tool modes.
- Security controls for remotely installed skills were weak.
- There was no first-class domain-pack lifecycle on the client.

The refactor goal is to move from a single-domain app to a **domain-pack-driven analysis shell** while keeping backward compatibility.

### ZH
重构前客户端明显偏“足球单域”实现，扩展成本越来越高：
- 数据源行为与单一内置领域耦合。
- 规划逻辑与兜底策略写死在足球语义上。
- 扩展 Skill 运行时表达能力不足，难以支撑动态工具模式。
- 远端安装 Skill 的安全边界薄弱。
- 客户端缺少一等公民的 Domain Pack 生命周期。

本次重构目标是：在不破坏现有体验的前提下，把应用升级成**可由 Domain Pack 驱动的通用分析壳**。

---

## 2) Non-Goals / 非目标

### EN
- No server schema redesign in this phase.
- No destructive migration for existing users.
- No removal of built-in football path.

### ZH
- 本阶段不做服务端协议/Schema 重构。
- 不做破坏性迁移（老用户无感升级优先）。
- 不移除内置足球路径（足球仍是默认兜底）。

---

## 3) Architecture Result (High-Level) / 架构结果（高层）

### EN
The client is now organized into five cooperating layers:

1. Domain layer
2. Planning strategy layer
3. Extension runtime layer
4. Security and compatibility layer
5. UX and operations layer

### ZH
当前客户端可抽象为 5 层协作：

1. 领域层（Domain）
2. 规划策略层（Planning Strategy）
3. 扩展运行时层（Extension Runtime）
4. 安全与兼容层（Security & Compatibility）
5. 交互与运维层（UX & Operations）

---

## 4) Detailed Change Breakdown / 详细改动拆解

## 4.1 Domain Layer / 领域层

### EN
New core abstractions:
- `AnalysisDomain` defines:
  - data source catalog
  - source resolution
  - capability building
  - recommended resources (templates/agents/skills/animations)

Primary files:
- `src/services/domains/types.ts`
- `src/services/domains/football.ts`
- `src/services/domains/registry.ts`

Behavior:
- Built-in domains are registered statically.
- Installed domain packs create alias domains at runtime.
- Active domain is resolved from settings; fallback remains `football`.

### ZH
新增核心抽象：
- `AnalysisDomain` 定义了：
  - 数据源目录
  - 数据源选择解析
  - 能力画像构建
  - 推荐资源（templates/agents/skills/animations）

关键文件：
- `src/services/domains/types.ts`
- `src/services/domains/football.ts`
- `src/services/domains/registry.ts`

运行逻辑：
- 内置领域静态注册。
- 已安装 Domain Pack 在运行时生成别名领域。
- 激活领域从 settings 读取，兜底仍为 `football`。

---

## 4.2 Planning Strategy Layer / 规划策略层

### EN
Planning is now strategy-based instead of football-hardcoded:
- `DomainPlanningStrategy` interface introduced.
- Football strategy extracted into its own module.
- Route resolution supports:
  - global autonomous switch
  - server-provided forced planning mode/template
  - domain strategy inference
- Domain-pack aliases can inherit planning strategy via `baseDomainId`.
- Plan normalization guarantees required terminal segment (prediction in football).

Primary files:
- `src/services/domains/planning/types.ts`
- `src/services/domains/planning/football.ts`
- `src/services/domains/planning/registry.ts`
- `src/services/ai/planning.ts`

### ZH
规划层已改为“策略化”，不再写死足球判断：
- 新增 `DomainPlanningStrategy` 接口。
- 足球规划策略拆分到独立模块。
- 路由决策支持：
  - 全局自主规划开关
  - 服务端强制规划模式/模板
  - 领域策略推导
- Domain Pack 别名可通过 `baseDomainId` 继承规划策略。
- 计划标准化会保证关键终端段落（足球为 prediction）。

关键文件：
- `src/services/domains/planning/types.ts`
- `src/services/domains/planning/football.ts`
- `src/services/domains/planning/registry.ts`
- `src/services/ai/planning.ts`

---

## 4.3 Extension Runtime Layer / 扩展运行时层

### EN
Skill runtime is extended to support multiple execution modes:
- `builtin_alias`
- `http_json`
- `static_result`

Runtime capabilities added:
- token interpolation for runtime payloads
- path extraction (`response.pickPath`)
- default fallback values (`response.defaultValue`)
- alias cycle detection

Primary files:
- `src/services/extensions/types.ts`
- `src/services/extensions/validation.ts`
- `src/skills/index.ts`

### ZH
Skill 运行时扩展为多模式：
- `builtin_alias`
- `http_json`
- `static_result`

新增能力：
- 运行时 payload 模板插值
- 返回路径提取（`response.pickPath`）
- 默认值兜底（`response.defaultValue`）
- alias 循环调用检测

关键文件：
- `src/services/extensions/types.ts`
- `src/services/extensions/validation.ts`
- `src/skills/index.ts`

---

## 4.4 Security and Compatibility Layer / 安全与兼容层

### EN
Security hardening added for remotely fetched manifests and runtime HTTP calls:

1. App version gate:
- build injects `__APP_VERSION__`
- manifests with `minAppVersion` are checked before install

2. Runtime URL constraints for `http_json`:
- only `https` allowed by default
- `http` allowed only for localhost
- embedded credentials blocked
- host allowlist enforced

3. Allowlist sources:
- default hosts (from `matchDataServerUrl`, localhost, current host)
- user setting: `skillHttpAllowedHosts`
- active domain pack: `skillHttpAllowedHosts`

Primary files:
- `src/services/appMeta.ts`
- `vite.config.ts`
- `src/types/global.d.ts`
- `src/services/extensions/hub.ts`
- `src/services/domains/packHub.ts`
- `src/skills/index.ts`

### ZH
针对远端 Manifest 与运行时 HTTP 调用新增了安全加固：

1. 应用版本门禁：
- 构建时注入 `__APP_VERSION__`
- 安装前校验 `minAppVersion`

2. `http_json` 运行时 URL 限制：
- 默认仅允许 `https`
- `http` 仅允许 localhost
- 禁止 URL 内嵌账号密码
- 强制 host 白名单

3. 白名单来源：
- 默认 host（`matchDataServerUrl`、localhost、当前 host）
- 用户设置 `skillHttpAllowedHosts`
- 激活 Domain Pack 的 `skillHttpAllowedHosts`

关键文件：
- `src/services/appMeta.ts`
- `vite.config.ts`
- `src/types/global.d.ts`
- `src/services/extensions/hub.ts`
- `src/services/domains/packHub.ts`
- `src/skills/index.ts`

---

## 4.5 Domain Pack Lifecycle / Domain Pack 生命周期

### EN
A dedicated domain-pack pipeline now exists:
- manifest type + validation + sanitization
- local store with version replacement semantics
- hub install flow with endpoint fallback + compatibility checks
- runtime alias registration
- UI management (install/update/uninstall/clear)

Primary files:
- `src/services/domains/packTypes.ts`
- `src/services/domains/packValidation.ts`
- `src/services/domains/packStore.ts`
- `src/services/domains/packHub.ts`
- `src/pages/ExtensionsHub.tsx`

### ZH
客户端已具备完整 Domain Pack 管线：
- Manifest 类型定义 + 校验 + 规整
- 本地存储 + 版本替换规则
- Hub 安装流程（多端点回退 + 兼容校验）
- 运行时别名领域注册
- UI 管理能力（安装/更新/卸载/清空）

关键文件：
- `src/services/domains/packTypes.ts`
- `src/services/domains/packValidation.ts`
- `src/services/domains/packStore.ts`
- `src/services/domains/packHub.ts`
- `src/pages/ExtensionsHub.tsx`

---

## 4.6 UX and Settings Surface / 设置与界面落地

### EN
Settings and analysis UI now expose domainized behavior:
- select active analysis domain
- configure skill HTTP allowlist
- keep agent-model config mode in data model but hide per-version UI usage
- one-click extension sync now seeds from active domain resources, then merges server snapshots

Primary files:
- `src/services/settings.ts`
- `src/pages/Settings.tsx`
- `src/services/extensions/recommendedSync.ts`

Match analysis payload now carries explicit domain context:
- `sourceContext.domainId`
- selected source flags and ids
- source capability snapshot

Primary files:
- `src/pages/MatchDetail.tsx`
- `src/services/analysisConfig.ts`

### ZH
设置页与分析页已经承载领域化能力：
- 可选择当前激活分析领域
- 可配置 Skill HTTP 白名单
- 模型配置模式在数据结构保留，但当前版本 UI 隐藏“配置模式”入口
- 一键同步会先注入激活领域推荐资源，再融合服务端样本快照

关键文件：
- `src/services/settings.ts`
- `src/pages/Settings.tsx`
- `src/services/extensions/recommendedSync.ts`

分析数据载荷已携带显式领域上下文：
- `sourceContext.domainId`
- 选中的数据源标记与 ID
- 数据源能力快照

关键文件：
- `src/pages/MatchDetail.tsx`
- `src/services/analysisConfig.ts`

---

## 5) Runtime Flows / 关键运行链路

## 5.1 Analysis Run Flow / 一次分析的执行链路

### EN
1. User selects sources in `MatchDetail`.
2. Active domain applies/removes source data and builds capability map.
3. `sourceContext` is written into payload (`domainId`, selected ids, capabilities).
4. Optional server planning config is merged.
5. Planning route is resolved:
   - forced mode/template > global autonomous switch > domain strategy
6. Required template/agents/skills are ensured via hub runtime installers.
7. Plan is normalized (agent defaults, animation defaults, terminal segment guarantee).
8. Segment agents stream output.
9. Animation and tags are post-processed with validation.
10. Summary agent finalizes output.

### ZH
1. 用户在 `MatchDetail` 选择数据源。
2. 激活领域执行数据源注入/移除并生成能力画像。
3. 将 `sourceContext` 写入分析 payload（含 `domainId`、source ids、capabilities）。
4. 可选地合并服务端下发规划配置。
5. 解析规划路线：
   - 强制模式/模板 > 全局自主规划开关 > 领域策略推导
6. 通过扩展运行时确保模板/Agent/Skill 就绪（必要时从 Hub 拉取）。
7. 归一化计划（默认 agent、默认 animation、终端段落保证）。
8. 分段 Agent 流式输出。
9. 动画参数与标签做后处理校验。
10. Summary Agent 输出总结。

---

## 5.2 Tool Calling Flow by Model Family / 分模型工具调用链路

### EN
Gemini path:
- native function/tool calling
- tool result is sent back through function response messages

DeepSeek/OpenAI-compatible path:
- prefer native tool calls when model supports them
- fallback to manual `<tool_call>...</tool_call>` protocol when tool-calling is unsupported
- reasoning-only models (e.g., R1/reasoner naming) default to manual mode

Implication:
- Manual mode may create extra system text chunks during streaming, which can amplify preview refresh jitter if UI parser is too sensitive to chunk boundaries.

### ZH
Gemini 路径：
- 使用原生函数/工具调用
- 工具结果通过 function response 回注模型

DeepSeek/OpenAI-compatible 路径：
- 优先尝试原生 tool call
- 不支持时退回手动 `<tool_call>...</tool_call>` 协议
- 推理模型（如 R1/reasoner）默认走手动模式

影响：
- 手动模式可能产生更多系统文本片段；如果前端预览解析对 chunk 边界过于敏感，会放大闪烁刷新问题。

---

## 5.3 Recommended Sync Flow / 推荐同步链路

### EN
1. Pull latest matches sample (`/matches?limit=n`).
2. Parse planning snapshots from match payload.
3. Seed IDs from active domain resources first.
4. Merge template/agent/skill IDs and hub hints.
5. Install only missing items.
6. Expand template-declared dependencies.
7. Return synced/missing/error summary.

### ZH
1. 拉取样本比赛（`/matches?limit=n`）。
2. 从比赛数据提取 planning 快照。
3. 先注入激活领域推荐资源 ID。
4. 合并 template/agent/skill ID 与 hub hint。
5. 仅对缺失项执行安装。
6. 递归展开模板声明依赖。
7. 返回同步成功/缺失/错误摘要。

---

## 6) Data Contracts (Examples) / 数据契约示例

### EN
Analysis payload source context:

```json
{
  "sourceContext": {
    "origin": "imported",
    "domainId": "football",
    "selectedSources": {
      "fundamental": true,
      "market": true,
      "custom": false
    },
    "selectedSourceIds": ["fundamental", "market"],
    "capabilities": {
      "hasFundamental": true,
      "hasStats": true,
      "hasOdds": true,
      "hasCustom": false
    },
    "matchStatus": "upcoming"
  }
}
```

Domain pack manifest:

```json
{
  "id": "basketball_basic_pack",
  "version": "1.0.0",
  "name": "Basketball Basic Pack",
  "description": "Alias domain with recommended resources",
  "baseDomainId": "football",
  "minAppVersion": "1.2.0",
  "recommendedTemplates": ["basketball_standard"],
  "recommendedAgents": ["basketball_overview"],
  "recommendedSkills": ["fetch_team_injuries"],
  "skillHttpAllowedHosts": ["api.sportsdata.example.com"]
}
```

### ZH
分析 payload 的 `sourceContext` 示例：

```json
{
  "sourceContext": {
    "origin": "imported",
    "domainId": "football",
    "selectedSources": {
      "fundamental": true,
      "market": true,
      "custom": false
    },
    "selectedSourceIds": ["fundamental", "market"],
    "capabilities": {
      "hasFundamental": true,
      "hasStats": true,
      "hasOdds": true,
      "hasCustom": false
    },
    "matchStatus": "upcoming"
  }
}
```

Domain Pack Manifest 示例：

```json
{
  "id": "basketball_basic_pack",
  "version": "1.0.0",
  "name": "Basketball Basic Pack",
  "description": "Alias domain with recommended resources",
  "baseDomainId": "football",
  "minAppVersion": "1.2.0",
  "recommendedTemplates": ["basketball_standard"],
  "recommendedAgents": ["basketball_overview"],
  "recommendedSkills": ["fetch_team_injuries"],
  "skillHttpAllowedHosts": ["api.sportsdata.example.com"]
}
```

---

## 7) Backward Compatibility / 向后兼容策略

### EN
- Football stays the default domain and default planning fallback.
- Existing extension stores remain usable (same localStorage strategy with normalization).
- `agentModelMode` remains in settings schema for future reactivation.
- If a domain pack points to unknown `baseDomainId`, install can succeed but runtime alias is ignored safely.

### ZH
- 足球仍是默认领域和默认规划兜底。
- 现有扩展存储不作破坏性变更（保持 localStorage 归一化读取策略）。
- `agentModelMode` 仍保留在 settings schema，便于后续恢复“最优模型组合”能力。
- Domain Pack 若指向未知 `baseDomainId`，安装可成功但运行时会安全忽略该别名。

---

## 8) Risks and Current Gaps / 风险与当前缺口

### EN
1. Streaming jitter on reasoning models:
   - manual tool-call mode emits extra protocol text
   - UI parser should be chunk-tolerant and idempotent

2. Limited observability:
   - no dedicated client-side tool-call telemetry panel yet

3. Version gate UX:
   - min-version rejection exists but UI reason is not surfaced clearly

4. Domain strategy expansion:
   - only football strategy exists today

### ZH
1. 推理模型流式抖动风险：
   - 手动 tool-call 模式会产生额外协议文本
   - UI 解析器需具备 chunk 容错与幂等更新能力

2. 可观测性不足：
   - 目前还没有客户端工具调用可视化面板

3. 版本门禁提示不足：
   - 已有 min-version 拒绝逻辑，但 UI 提示不够明确

4. 领域策略扩展尚未展开：
   - 当前只有 football 策略实现

---

## 9) Operational Verification Checklist / 可执行验证清单

### EN
Run static checks:

```powershell
npx.cmd tsc --noEmit
```

Expected:
- no TypeScript errors

Manual runtime checks:
1. Install a domain pack from Extensions Hub.
2. Go to Settings and verify domain appears in Analysis Domain selector.
3. Select domain, save settings, open match detail.
4. Verify generated payload contains `sourceContext.domainId`.
5. Trigger one-click sync and verify:
   - domain resource IDs are included in target set
   - only missing extensions are installed
6. Test a `http_json` skill against:
   - allowed host: should pass
   - disallowed host: should fail with allowlist error
7. On DeepSeek R1, verify manual tool-call path can still execute skills.

### ZH
执行静态检查：

```powershell
npx.cmd tsc --noEmit
```

预期：
- TypeScript 零错误

手工运行验证：
1. 在 Extensions Hub 安装一个 Domain Pack。
2. 进入 Settings，确认 Analysis Domain 下拉出现该领域。
3. 选择该领域并保存，进入比赛分析页。
4. 确认生成 payload 含 `sourceContext.domainId`。
5. 触发“一键同步推荐扩展”，确认：
   - 目标集合包含领域推荐资源 ID
   - 仅缺失项会执行安装
6. 使用 `http_json` Skill 测试：
   - 白名单 host：通过
   - 非白名单 host：返回 allowlist 错误
7. 使用 DeepSeek R1 验证手动 tool-call 路径可执行 Skill。

---

## 10) Next Iteration Plan / 下一迭代建议

### EN
1. Add tool-call observability UI:
   - model/provider
   - native/manual mode
   - tool latency, success/failure

2. Improve preview stability:
   - normalize parser updates to segment-level diff
   - ignore transient protocol chunks in UI rendering pipeline

3. Extend domain strategy registry:
   - add non-football planning strategies
   - add strategy contract tests

4. Improve install diagnostics:
   - expose minAppVersion rejection reasons in UI

### ZH
1. 增加工具调用观测面板：
   - 模型/Provider
   - native/manual 模式
   - 工具耗时与成功率

2. 提升预览稳定性：
   - 解析器改为分段级 diff 更新
   - 渲染链路忽略瞬态协议片段

3. 扩展领域策略注册表：
   - 新增非足球策略实现
   - 补齐策略契约测试

4. 增强安装诊断：
   - UI 明确展示 `minAppVersion` 不满足原因

