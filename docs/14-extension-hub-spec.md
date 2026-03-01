# Extension Hub Specification / 扩展 Hub 规范

## EN

## 1. Purpose

This specification defines how MatchFlow distributes and installs extension manifests:

1. Agent manifests
2. Skill manifests
3. Template manifests

It is used by both:

1. Server hub endpoints
2. Client runtime validation and auto-install flow

## 2. Common Manifest Fields

All extension manifests must include:

```json
{
  "kind": "agent|skill|template",
  "id": "stable_id",
  "version": "x.y.z",
  "name": "Readable Name",
  "description": "What this extension does"
}
```

Rules:

1. `id` should be lowercase and stable.
2. `version` should follow semantic versioning.
3. `kind` must be exactly one of `agent`, `skill`, `template`.

## 3. Agent Manifest

Required extra fields:

1. `rolePrompt.en`
2. `rolePrompt.zh`

Optional fields:

1. `skills`
2. `contextDependencies`

Example:

```json
{
  "kind": "agent",
  "id": "momentum_agent",
  "version": "1.0.0",
  "name": "Momentum Agent",
  "description": "Analyzes momentum swings in live matches.",
  "rolePrompt": {
    "en": "You are a momentum analyst...",
    "zh": "你是比赛动量分析专家。"
  },
  "skills": ["calculator"],
  "contextDependencies": ["overview", "odds", "stats"]
}
```

## 4. Skill Manifest

Current runtime security model supports alias-only distributed skills:

1. `runtime.mode = "builtin_alias"`
2. `runtime.targetSkill` points to an existing built-in skill

Example:

```json
{
  "kind": "skill",
  "id": "select_plan_template_v2",
  "version": "1.0.0",
  "name": "Template Selector V2",
  "description": "Alias skill for selecting templates.",
  "declaration": {
    "name": "select_plan_template_v2",
    "description": "Select template",
    "parameters": { "type": "object" }
  },
  "runtime": {
    "mode": "builtin_alias",
    "targetSkill": "select_plan_template"
  }
}
```

## 5. Template Manifest

Required extra fields:

1. `rule`
2. `segments[]`

Each segment must include:

1. `title.en`, `title.zh`
2. `focus.en`, `focus.zh`
3. `agentType`

Optional fields:

1. `requiredAgents`
2. `requiredSkills`
3. `animationType`
4. `contextMode`

Example:

```json
{
  "kind": "template",
  "id": "live_market_pro",
  "version": "1.0.0",
  "name": "Live Market Pro",
  "description": "Live workflow with momentum and market reaction.",
  "rule": "Use for live matches with rich odds and stats.",
  "requiredAgents": ["overview", "momentum_agent", "odds", "prediction"],
  "requiredSkills": ["select_plan_template_v2"],
  "segments": [
    {
      "title": { "en": "Live Overview", "zh": "实时总览" },
      "focus": { "en": "Current state summary", "zh": "当前局势总结" },
      "animationType": "scoreboard",
      "agentType": "overview",
      "contextMode": "independent"
    }
  ]
}
```

## 6. Hub Endpoint Compatibility

Client attempts all of these endpoint patterns:

1. `/hub/{kind}s/:id`
2. `/hub/{kind}/:id`
3. `/extensions/{kind}s/:id`
4. `/extensions/{kind}/:id`

Optional query parameters:

1. `version`
2. `channel`

## 7. Accepted Response Shapes

Client accepts:

1. `{ "data": { ...manifest } }`
2. `{ "manifest": { ...manifest } }`
3. direct manifest object

## 8. Planning-Driven Auto-Install Contract

Server can guide runtime installation via planning hints:

```json
{
  "sourceContext": {
    "planning": {
      "templateId": "live_market_pro",
      "requiredAgents": ["momentum_agent"],
      "requiredSkills": ["select_plan_template_v2"],
      "hub": {
        "baseUrl": "https://your-server",
        "apiKey": "optional",
        "autoInstall": true
      }
    }
  }
}
```

## 9. Runtime Behavior (Expected)

1. Resolve planning route.
2. Ensure template is available (install if missing).
3. Ensure required agents and skills are available.
4. Generate segment plan.
5. Ensure per-segment agent is available before execution.
6. Fallback to built-in safe path if install fails.

## ZH

## 1. 目的

本规范定义 MatchFlow 扩展清单（Manifest）的分发与安装契约，覆盖：

1. Agent Manifest
2. Skill Manifest
3. Template Manifest

该规范同时用于：

1. 服务端 Hub 接口返回
2. 客户端运行时校验与自动安装

## 2. 通用字段

所有 Manifest 必须包含：

```json
{
  "kind": "agent|skill|template",
  "id": "stable_id",
  "version": "x.y.z",
  "name": "Readable Name",
  "description": "What this extension does"
}
```

规则：

1. `id` 建议小写且稳定。
2. `version` 必须符合语义化版本。
3. `kind` 只能是 `agent/skill/template`。

## 3. Agent Manifest

必填扩展字段：

1. `rolePrompt.en`
2. `rolePrompt.zh`

可选：

1. `skills`
2. `contextDependencies`

示例：

```json
{
  "kind": "agent",
  "id": "momentum_agent",
  "version": "1.0.0",
  "name": "Momentum Agent",
  "description": "Analyzes momentum swings in live matches.",
  "rolePrompt": {
    "en": "You are a momentum analyst...",
    "zh": "你是比赛动量分析专家。"
  },
  "skills": ["calculator"],
  "contextDependencies": ["overview", "odds", "stats"]
}
```

## 4. Skill Manifest

当前分发 Skill 采用安全别名模式：

1. `runtime.mode = "builtin_alias"`
2. `runtime.targetSkill` 指向本地已存在的内置 Skill

示例：

```json
{
  "kind": "skill",
  "id": "select_plan_template_v2",
  "version": "1.0.0",
  "name": "Template Selector V2",
  "description": "Alias skill for selecting templates.",
  "declaration": {
    "name": "select_plan_template_v2",
    "description": "Select template",
    "parameters": { "type": "object" }
  },
  "runtime": {
    "mode": "builtin_alias",
    "targetSkill": "select_plan_template"
  }
}
```

## 5. Template Manifest

必填扩展字段：

1. `rule`
2. `segments[]`

每个 segment 必须包含：

1. `title.en/title.zh`
2. `focus.en/focus.zh`
3. `agentType`

可选：

1. `requiredAgents`
2. `requiredSkills`
3. `animationType`
4. `contextMode`

示例：

```json
{
  "kind": "template",
  "id": "live_market_pro",
  "version": "1.0.0",
  "name": "Live Market Pro",
  "description": "Live workflow with momentum and market reaction.",
  "rule": "Use for live matches with rich odds and stats.",
  "requiredAgents": ["overview", "momentum_agent", "odds", "prediction"],
  "requiredSkills": ["select_plan_template_v2"],
  "segments": [
    {
      "title": { "en": "Live Overview", "zh": "实时总览" },
      "focus": { "en": "Current state summary", "zh": "当前局势总结" },
      "animationType": "scoreboard",
      "agentType": "overview",
      "contextMode": "independent"
    }
  ]
}
```

## 6. Hub 路径兼容

客户端按如下路径回退：

1. `/hub/{kind}s/:id`
2. `/hub/{kind}/:id`
3. `/extensions/{kind}s/:id`
4. `/extensions/{kind}/:id`

可选查询参数：

1. `version`
2. `channel`

## 7. 响应格式兼容

客户端可接受：

1. `{ "data": { ...manifest } }`
2. `{ "manifest": { ...manifest } }`
3. 直接返回 manifest 对象

## 8. 规划驱动自动安装契约

服务端可在规划信息中返回缺失扩展提示：

```json
{
  "sourceContext": {
    "planning": {
      "templateId": "live_market_pro",
      "requiredAgents": ["momentum_agent"],
      "requiredSkills": ["select_plan_template_v2"],
      "hub": {
        "baseUrl": "https://your-server",
        "apiKey": "optional",
        "autoInstall": true
      }
    }
  }
}
```

## 9. 运行期预期行为

1. 决策规划路由。
2. 校验并安装模板（若缺失）。
3. 校验并安装必需 Agent/Skill。
4. 生成分段计划。
5. 每段执行前再次确认目标 Agent 可用。
6. 安装失败时回退内置安全路径。

