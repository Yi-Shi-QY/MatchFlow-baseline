# Agent Construction Guide

This guide describes how to add or modify agents safely.

## 1. Required Rules

1. Implement `AgentConfig` from `src/agents/types.ts`.
2. Keep `id` stable after release.
3. Make prompts language-aware using `context.language`.
4. Output must follow parser contracts used by `agentParser.ts`.

## 2. Prompt Construction

Use `buildAnalysisPrompt` from `src/agents/utils.ts` for normal specialist agents.

Recommended pattern:

```ts
const rolePrompts = {
  en: "...",
  zh: "..."
};

export const myAgent: AgentConfig = {
  id: "my_agent",
  name: "...",
  description: "...",
  skills: [],
  contextDependencies: "all",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  }
};
```

## 3. Context Dependencies

Set `contextDependencies` intentionally:
- `'none'`: independent analysis
- `'all'`: can consume all previous segments
- `['stats', 'tactical']`: targeted dependencies

Avoid unnecessary `all` if repetition is common.

## 4. Skills

If the agent needs deterministic computation/tooling, add skill names in `skills`.

Current supported skills:
- `calculator`
- `select_plan_template`

When adding a new skill:
1. Add declaration + executor in `src/skills`.
2. Register builtin executor in `executeSkill` and builtin declaration map in `src/skills/index.ts`.
3. If the skill should be distributable via hub, add manifest contract in `src/docs/EXTENSION_HUB_SPEC.md`.
4. Runtime-distributed skills currently use secure alias mode (`runtime.mode = "builtin_alias"`).
5. Add agent-level `skills` entry.

## 5. Planner Integration

For a new specialist agent to run automatically:
1. Register it in `src/agents/index.ts`.
2. Ensure planner templates can emit `agentType` with your agent id.
3. Ensure `animationType` values map to supported template types.

## 6. Validation Checklist

Before merge:
- `npm run lint`
- Start one analysis with animations on/off
- Verify parser sees complete tags
- Verify no fallback errors in `RemotionPlayer`
