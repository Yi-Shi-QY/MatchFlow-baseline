# Extension Hub Spec (Agents / Skills / Templates)

This document defines the extension contract used by MatchFlow to support:
- versioned agent/skill/template manifests
- local validation and persistence
- on-demand download from server-side hub

## 1. Goals

1. Keep built-in runtime stable while allowing remote extension growth.
2. Ensure every extension is validated before installation.
3. Support server-recommended templates that auto-install missing dependencies.

## 2. Supported Extension Kinds

1. `agent`
2. `skill`
3. `template`

All manifests require:

```json
{
  "kind": "agent|skill|template",
  "id": "stable_id",
  "version": "1.2.3",
  "name": "Human Name",
  "description": "What this extension does"
}
```

## 3. Agent Manifest

```json
{
  "kind": "agent",
  "id": "injury_risk_agent",
  "version": "1.0.0",
  "name": "Injury Risk Analyst",
  "description": "Analyzes injury impact",
  "rolePrompt": {
    "en": "You are an injury-risk specialist...",
    "zh": "你是一名伤停风险分析专家..."
  },
  "skills": ["calculator"],
  "contextDependencies": ["overview", "stats"]
}
```

## 4. Skill Manifest

For security, current runtime supports declarative skill aliasing only.

```json
{
  "kind": "skill",
  "id": "select_plan_template_v2",
  "version": "1.0.0",
  "name": "Template Selector V2",
  "description": "Alias to built-in template selector",
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

```json
{
  "kind": "template",
  "id": "live_market_pro",
  "version": "1.0.0",
  "name": "Live Market Pro",
  "description": "Live match market-centric workflow",
  "rule": "Use for live matches with rich odds streams",
  "requiredAgents": ["overview", "odds", "momentum_agent"],
  "requiredSkills": ["calculator"],
  "segments": [
    {
      "title": { "en": "Overview", "zh": "比赛概览" },
      "focus": { "en": "Situation summary", "zh": "当前态势总结" },
      "animationType": "none",
      "agentType": "overview",
      "contextMode": "independent"
    }
  ]
}
```

## 6. Hub Endpoint Conventions

Client will attempt these endpoints:

1. `/hub/{kind}s/{id}`
2. `/hub/{kind}/{id}`
3. `/extensions/{kind}s/{id}`
4. `/extensions/{kind}/{id}`

Response body supports:

1. `{ "data": { ...manifest } }`
2. `{ "manifest": { ...manifest } }`
3. direct manifest object

## 7. Source Context Integration

Server can guide runtime installation via:

```json
{
  "sourceContext": {
    "planning": {
      "templateId": "live_market_pro",
      "requiredAgents": ["momentum_agent"],
      "requiredSkills": ["select_plan_template_v2"],
      "hub": {
        "baseUrl": "https://your-matchflow-server",
        "apiKey": "optional",
        "autoInstall": true
      }
    }
  }
}
```

## 8. Runtime Behavior

1. Resolve planning route.
2. Ensure required template is installed.
3. Ensure required agents/skills are installed.
4. Generate plan.
5. Before each segment run, re-check target agent availability.

If install fails, runtime falls back to built-in behavior (`general` agent or default template path).

