# MatchFlow Project Guide

## 1. Goals

This repository provides a local-first football analysis product that supports:
- Web
- Android (Capacitor)
- iOS (Capacitor)

The core is an AI orchestration pipeline with structured streaming output.

## 2. Repository Structure

```text
/
|- src/
|  |- agents/                 # Agent definitions (planner, specialists, tag, summary, animation)
|  |- components/             # UI components, including RemotionPlayer
|  |- contexts/               # Global runtime state (AnalysisContext)
|  |- pages/                  # Home, MatchDetail, Settings, Scan, Share
|  |- services/
|  |  |- ai.ts                # Main AI orchestration and provider abstraction
|  |  |- agentParser.ts       # Streaming tag parser
|  |  |- matchData.ts         # Match list fetcher
|  |  |- history.ts           # History + resume persistence
|  |  |- remotion/            # Template registry and payload validation
|  |- skills/                 # Function-calling tool declarations and executors
|  |- data/                   # Mock match data
|- match-data-server/         # Optional backend for match data
|- android/ ios/              # Capacitor native projects
```

## 3. Runtime Data Flow

### 3.1 Analysis Execution

1. User starts analysis in `MatchDetail`.
2. `AnalysisContext.startAnalysis` initializes state and optional resume data.
3. `streamAgentThoughts` performs:
   - Plan generation (`planner_template` or `planner_autonomous`)
   - Segment execution by specialist agents
   - Optional animation extraction + validation/retry
   - Segment tag extraction
   - Final summary generation
4. Stream text is parsed continuously by `parseAgentStream` and rendered incrementally.
5. Completed result is saved to history and removed from saved-match staging.

### 3.2 Animation Flow

- Agents output analysis text.
- `animation` agent extracts template params.
- `validateAndNormalizeAnimationPayload` enforces required params and normalizes data.
- `RemotionPlayer` renders by `templateId` from `TEMPLATES`.

No runtime TSX code generation/eval path is used in the active flow.

## 4. Service / Agent / Skill Boundaries

- Services orchestrate lifecycle and persistence.
- Agents define domain behavior and output schema.
- Skills provide deterministic local tools (`calculator`, `select_plan_template`).

See `AI_AGENT_FRAMEWORK.md` for details.

## 5. Operational Notes

- Settings are localStorage-based (`settings.ts`).
- On native platforms, history/resume/saved matches can use SQLite with localStorage fallback.
- Match data server is optional. Without it, UI falls back to mock matches.
