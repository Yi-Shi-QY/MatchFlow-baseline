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

`streamAIRequest` handles provider-specific tool-calling loops for Gemini and DeepSeek.

## 5. Active Agent Roster

- Orchestration: `planner_template`, `planner_autonomous`, `tag`, `summary`, `animation`
- Specialists: `overview`, `stats`, `tactical`, `odds`, `prediction`, `general`

## 6. Removed Legacy Paths

The following legacy path is no longer part of active architecture:
- Dynamic Remotion TSX code generation and repair loop

Animation rendering is now template-parameter based only.
