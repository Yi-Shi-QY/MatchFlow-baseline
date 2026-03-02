# AI Agent Framework / AI Agent 框架

## EN

## 1. Framework Intent

MatchFlow uses a structured multi-agent pipeline to produce analysis that is:

1. Explainable (tagged sections).
2. Incremental (streamed UI rendering).
3. Controllable (planner routes + deterministic skills).
4. Extensible (manifest-distributed agents/skills/templates).

## 2. Output Contract

Runtime parser expects structured tags:

1. `<title>`
2. `<thought>`
3. `<animation>`
4. `<tags>`
5. `<summary>`

Agents must preserve this contract to avoid downstream parse failures.

## 3. Agent Contract

All agents implement `AgentConfig`:

```ts
interface AgentConfig {
  id: string;
  name: string;
  description: string;
  skills?: string[];
  contextDependencies?: string[] | "all" | "none";
  systemPrompt: (context: AgentContext) => string;
}
```

## 4. Pipeline Phases

1. Planning:
   - Template route or autonomous plan.
2. Segment execution:
   - Select specialist by `agentType`.
   - Build dependency-filtered prior context.
3. Optional animation extraction and validation.
4. Tag extraction.
5. Final summary generation.

## 5. Skill Runtime

1. Built-in deterministic skills (e.g., calculator, template selector).
2. Tool-call flow:
   - Native tool call first.
   - Fallback manual protocol for non-compliant endpoints/models.
3. Runtime-distributed skills use secure alias mode (`builtin_alias`).

## 6. Model Routing

1. `global` mode:
   - all agents share one provider/model.
2. `config` mode:
   - per-agent provider/model from config file.
3. Supported provider formats:
   - Gemini
   - DeepSeek (`deepseek-chat`, `deepseek-reasoner`)
   - OpenAI-compatible chat completions endpoints

## 7. Planner Decision Inputs

Planner route is based on:

1. App settings (`enableAutonomousPlanning`, model mode, etc.).
2. `sourceContext.selectedSources`
3. `sourceContext.capabilities`
4. Optional server-provided `sourceContext.planning` overrides.

## 8. Stability Rules

1. Never change agent IDs casually.
2. Never break output tags.
3. Add tests/validation for new planning branches.
4. Keep fallback plan available when planner output is invalid.

## ZH

## 1. 框架目标

MatchFlow 采用结构化多 Agent 流程，确保分析结果具备：

1. 可解释性（标签化结构输出）。
2. 增量可视化（流式渲染）。
3. 可控性（规划路由 + 确定性 Skill）。
4. 可扩展性（可分发的扩展清单）。

## 2. 输出契约

运行时解析器依赖以下标签：

1. `<title>`
2. `<thought>`
3. `<animation>`
4. `<tags>`
5. `<summary>`

Agent 输出必须维持该契约，否则会导致后续解析失败。

## 3. Agent 契约

所有 Agent 实现统一 `AgentConfig`：

```ts
interface AgentConfig {
  id: string;
  name: string;
  description: string;
  skills?: string[];
  contextDependencies?: string[] | "all" | "none";
  systemPrompt: (context: AgentContext) => string;
}
```

## 4. 运行阶段

1. 规划阶段：
   - 模板规划或自主规划。
2. 分段执行：
   - 根据 `agentType` 选择专项 Agent。
   - 按依赖策略过滤上下文。
3. 可选动画参数提取与校验。
4. 标签提取。
5. 最终总结。

## 5. Skill 运行机制

1. 内置确定性 Skill（如计算器、模板选择器）。
2. 工具调用流程：
   - 优先原生 tool call。
   - 不兼容时回退手动协议。
3. Hub 下发 Skill 目前采用 `builtin_alias` 安全模式。

## 6. 模型路由

1. `global` 模式：
   - 所有 Agent 共用一个 provider/model。
2. `config` 模式：
   - 每个 Agent 独立 provider/model 配置。
3. 兼容格式：
   - Gemini
   - DeepSeek（`deepseek-chat`、`deepseek-reasoner`）
   - OpenAI Chat Completions 兼容接口

## 7. 规划输入信号

规划路由综合以下输入：

1. 应用设置（如 `enableAutonomousPlanning`）。
2. `sourceContext.selectedSources`
3. `sourceContext.capabilities`
4. 服务端下发的 `sourceContext.planning` 覆盖项。

## 8. 稳定性规则

1. 不要随意改 Agent ID。
2. 不要破坏结构化标签契约。
3. 新增规划分支必须有校验或测试。
4. 规划失败时必须保留回退计划。

