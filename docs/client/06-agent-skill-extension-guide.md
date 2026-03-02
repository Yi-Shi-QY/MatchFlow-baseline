# Agent / Skill / Template Extension Guide / 扩展开发指南

## EN

## 1. Scope

This guide covers extension development for:

1. Agents
2. Skills
3. Plan templates
4. Hub manifest distribution and lifecycle

## 2. Agent Extension

## 2.1 Steps

1. Create a new file in `src/agents/`.
2. Implement `AgentConfig`.
3. Register agent in `src/agents/index.ts`.
4. Ensure planner/template can emit the new `agentType`.

## 2.2 Best Practices

1. Keep `id` stable after release.
2. Use language-aware prompts (`context.language`).
3. Use minimal necessary `contextDependencies`.
4. Preserve structured output tags.

## 3. Skill Extension

## 3.1 Built-in Skill Path

1. Add declaration + executor in `src/skills`.
2. Register in skill registry.
3. Add tests or basic runtime verification.

## 3.2 Distributed Skill Path

1. Publish skill manifest from hub.
2. Use secure runtime mode:
   - `runtime.mode = "builtin_alias"`
   - `runtime.targetSkill = "<existing_builtin_skill_id>"`

## 4. Template Extension

Template manifest requirements:

1. `kind = "template"`
2. `id`, `version`, `name`, `description`, `rule`
3. `segments[]` with bilingual `title` + `focus`
4. Optional `requiredAgents` and `requiredSkills`

## 5. Manifest Validation Rules

1. `id` pattern must be stable and lowercase-safe.
2. `version` must follow semantic version format.
3. `kind` must be one of `agent | skill | template`.
4. Agent requires `rolePrompt.en` and `rolePrompt.zh`.
5. Skill requires declaration name and runtime alias target.
6. Template requires non-empty segment list and agent types.

## 6. Version Lifecycle

Recommended server lifecycle states:

1. `draft`
2. `published`
3. `deprecated`

Recommended channels:

1. `stable`
2. `beta`
3. `internal`

## 7. Hub Endpoint Compatibility

Client fallback attempts:

1. `/hub/{kind}s/:id`
2. `/hub/{kind}/:id`
3. `/extensions/{kind}s/:id`
4. `/extensions/{kind}/:id`

Response payload supports:

1. `{ data: manifest }`
2. `{ manifest: manifest }`
3. `manifest` directly

## 8. Auto-Install Integration

Server can include planning hints:

```json
{
  "sourceContext": {
    "planning": {
      "templateId": "live_market_pro",
      "requiredAgents": ["momentum_agent"],
      "requiredSkills": ["select_plan_template_v2"],
      "hub": {
        "baseUrl": "https://server",
        "apiKey": "optional",
        "autoInstall": true
      }
    }
  }
}
```

## ZH

## 1. 适用范围

本指南覆盖以下扩展开发：

1. Agent
2. Skill
3. 规划模板（Template）
4. Hub Manifest 分发与版本生命周期

## 2. Agent 扩展

## 2.1 操作步骤

1. 在 `src/agents/` 新建 Agent 文件。
2. 实现 `AgentConfig`。
3. 在 `src/agents/index.ts` 注册。
4. 让规划器或模板能够输出该 `agentType`。

## 2.2 实践建议

1. 公开后不要随意改 Agent `id`。
2. 提示词要按 `context.language` 适配中英文。
3. `contextDependencies` 只声明必要依赖。
4. 保持结构化标签输出契约。

## 3. Skill 扩展

## 3.1 内置 Skill 路径

1. 在 `src/skills` 增加声明与执行器。
2. 在 skill registry 中注册。
3. 补充基础测试或运行验证。

## 3.2 分发 Skill 路径

1. 通过 Hub 发布 Skill manifest。
2. 运行时使用安全别名模式：
   - `runtime.mode = "builtin_alias"`
   - `runtime.targetSkill = "<已有内置 skill id>"`

## 4. Template 扩展

模板 manifest 基本要求：

1. `kind = "template"`
2. 包含 `id/version/name/description/rule`
3. `segments[]` 必须包含双语 `title/focus`
4. 可选 `requiredAgents`、`requiredSkills`

## 5. Manifest 校验要点

1. `id` 命名规则稳定且小写安全。
2. `version` 满足语义化版本格式。
3. `kind` 必须为 `agent | skill | template`。
4. Agent 必须有 `rolePrompt.en/zh`。
5. Skill 必须有 declaration name 和 runtime alias 目标。
6. Template 必须有非空分段与 `agentType`。

## 6. 版本生命周期

建议状态：

1. `draft`
2. `published`
3. `deprecated`

建议渠道：

1. `stable`
2. `beta`
3. `internal`

## 7. Hub 路径兼容

客户端按以下顺序回退：

1. `/hub/{kind}s/:id`
2. `/hub/{kind}/:id`
3. `/extensions/{kind}s/:id`
4. `/extensions/{kind}/:id`

服务端返回可接受格式：

1. `{ data: manifest }`
2. `{ manifest: manifest }`
3. `manifest` 直接对象

## 8. 自动安装接入

服务端可通过规划字段下发安装提示：

```json
{
  "sourceContext": {
    "planning": {
      "templateId": "live_market_pro",
      "requiredAgents": ["momentum_agent"],
      "requiredSkills": ["select_plan_template_v2"],
      "hub": {
        "baseUrl": "https://server",
        "apiKey": "optional",
        "autoInstall": true
      }
    }
  }
}
```

