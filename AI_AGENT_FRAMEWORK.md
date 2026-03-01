# MatchFlow AI Agent Framework

## 1. Core Concepts

The framework is a structured multi-agent pipeline with strict output tags.

- Structured output tags: `<title>`, `<thought>`, `<animation>`, `<tags>`, `<summary>`
- Planner-driven segment orchestration
- Per-agent context dependency filtering
- Optional tool calling via skills

## 2. Agent Contract

All agents implement `AgentConfig`:

```ts
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  skills?: string[];
  contextDependencies?: string[] | 'all' | 'none';
  systemPrompt: (context: AgentContext) => string;
}
```

## 3. Pipeline Phases

### Phase A: Planning

Entry: `generateAnalysisPlan` in `src/services/ai.ts`.

Modes:
- `planner_template`: selects one of predefined templates using `select_plan_template` skill.
- `planner_autonomous`: writes a custom segment plan directly.

Output: JSON array of segment plans.

### Phase B: Segment Execution

Entry: `streamAnalysisAgent`.

For each segment:
- Select specialist agent by `segment.agentType`
- Build filtered context based on `contextDependencies`
- Stream `<title>` + `<thought>`
- If enabled and needed, run animation extraction and payload validation
- Run `tag` agent to produce `<tags>`

### Phase C: Summary

Entry: `streamSummaryAgent`.

Output: `<summary>` JSON with prediction, probabilities, expected goals, key factors.

## 4. Skill Runtime

Skills are declared in `src/skills/index.ts` and executed by `executeSkill`.

Current active skills:
- `calculator`
- `select_plan_template`

`streamAIRequest` handles provider-specific tool-calling loops for Gemini and OpenAI-compatible providers (including DeepSeek).

## 5. Active Agent Roster

- Orchestration: `planner_template`, `planner_autonomous`, `tag`, `summary`, `animation`
- Specialists: `overview`, `stats`, `tactical`, `odds`, `prediction`, `general`

## 6. Agent Model Routing

Model selection now supports two runtime modes from Settings:

- `global`: all agents use one shared `provider + model` pair.
- `config`: each agent can use its own provider/model from `src/config/agentModelConfig.ts`.

Supported providers:
- `gemini`
- `deepseek` (V3 and R1/Reasoner models)
- `openai_compatible` (any endpoint implementing OpenAI Chat Completions format)

Resolution order at runtime:
1. If mode is `config` and the current agent has an entry in `AGENT_MODEL_CONFIG`, use that entry.
2. Otherwise fall back to the global provider/model from Settings.

This resolution is applied inside `streamAIRequest` in `src/services/ai.ts`, so all pipeline stages
(planner, specialist agents, tag, summary, animation/fix) use consistent routing.

Tool calling compatibility:
- First try native tool calls.
- If model/endpoint rejects tools (typical for some reasoning models), runtime falls back to manual tool-call protocol (`<tool_call>...</tool_call>`).

## 7. Removed Legacy Paths

The following legacy path is no longer part of active architecture:
- Dynamic Remotion TSX code generation and repair loop

Animation rendering is now template-parameter based only.
