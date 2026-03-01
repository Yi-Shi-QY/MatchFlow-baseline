# MatchFlow

MatchFlow is a multi-agent football analysis app built with React + Capacitor.

It combines:
- A planner + specialist agent pipeline
- Local tool calling (skills)
- Parameter-based Remotion templates for animation rendering
- Local-first persistence for history and resume state

## Current Architecture (March 2026)

The runtime flow is:
1. `MatchDetail` collects selected match data.
2. `AnalysisContext.startAnalysis` starts and tracks a streaming task.
3. `streamAgentThoughts` executes: planner -> specialist segments -> animation extraction/validation -> tag extraction -> final summary.
4. `agentParser` parses `<title>`, `<thought>`, `<animation>`, `<tags>`, `<summary>`.
5. `RemotionPlayer` renders validated animation payloads by template id.

## Documentation

- Architecture overview: `PROJECT_GUIDE.md`
- Agent framework details: `AI_AGENT_FRAMEWORK.md`
- Agent authoring guide: `src/docs/AGENT_GUIDE.md`
- Data service deployment: `match-data-server/DEPLOY.md`
- Day-to-day development commands: `DEVELOPMENT.md`

## Quick Start

```bash
npm install
npm run dev
```

Type check:

```bash
npm run lint
```

Build:

```bash
npm run build
```

## Notes

- The app router currently uses `BrowserRouter`.
- Match list data is fetched from `src/services/matchData.ts` and falls back to mock data when no server is configured.
- Legacy dynamic Remotion code generation paths were removed. The app now only uses parameterized templates.
