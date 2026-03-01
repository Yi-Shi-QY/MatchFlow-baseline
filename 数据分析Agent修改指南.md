# Data Analysis Agent Extension Guide

This document is kept for compatibility with previous naming.

Please use:
- `src/docs/AGENT_GUIDE.md` for agent authoring
- `AI_AGENT_FRAMEWORK.md` for runtime orchestration

## Quick Extension Steps

1. Add a new agent file in `src/agents/` implementing `AgentConfig`.
2. Register the agent in `src/agents/index.ts`.
3. Add planner output rules so the new `agentType` can be selected.
4. If needed, add skills in `src/skills/` and register executors.
5. Run `npm run lint` and verify one full stream in UI.
