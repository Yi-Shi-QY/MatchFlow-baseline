# Client File Structure Refactor (2026-03-03)

## Goal

Make the client codebase easier to evolve for multiple analysis domains (football, basketball, and future domains) by reducing flat file layouts and introducing domain-scoped folders.

## What Changed

### 1. Agent files are now domain-scoped

Before:

- `src/agents/overview.ts`
- `src/agents/stats.ts`
- `src/agents/tactical.ts`
- `src/agents/odds.ts`
- `src/agents/prediction.ts`
- `src/agents/general.ts`
- `src/agents/basketball_*.ts`

After:

- `src/agents/domains/football/*`
- `src/agents/domains/basketball/*`
- `src/agents/index.ts` imports through folder barrels:
  - `src/agents/domains/football/index.ts`
  - `src/agents/domains/basketball/index.ts`

Shared and cross-domain agents stay in `src/agents/` root for now:

- planner agents
- summary/tag/animation
- prompt helpers and types

### 2. Planner templates are now domain-scoped

Before:

- `src/skills/planner/templates/basic.ts`
- `src/skills/planner/templates/standard.ts`
- `src/skills/planner/templates/odds_focused.ts`
- `src/skills/planner/templates/comprehensive.ts`
- `src/skills/planner/templates/basketball_*.ts`

After:

- `src/skills/planner/templates/football/*`
- `src/skills/planner/templates/basketball/*`
- `src/skills/planner/index.ts` imports via folder barrels:
  - `src/skills/planner/templates/football/index.ts`
  - `src/skills/planner/templates/basketball/index.ts`

### 3. Planner routing prompts remain domain-aware

The planner prompt layer (`planner_template` / `planner_autonomous`) still routes by domain and now works with the new folder structure without path coupling.

## Benefits

- Better scalability for new domains (less collision in `src/agents` and template folders).
- Clear ownership boundaries:
  - domain-specific logic in domain folders
  - shared logic in root/shared layers
- Lower cognitive load for contributors and easier code review.

## Follow-up Recommendations

### A. Services layer domain split (next phase)

Current domain service files are still relatively flat:

- `src/services/domains/football.ts`
- `src/services/domains/basketball.ts`
- `src/services/domains/planning/*`

Recommended next step:

- `src/services/domains/modules/football/*`
- `src/services/domains/modules/basketball/*`
- keep thin compatibility exports in existing paths during migration.

### B. Shared-vs-domain agent utilities

If domain agents continue to grow, extract:

- `src/agents/shared/*` for reusable prompt helpers
- keep domain-only narrative logic inside each domain folder.

### C. Locale normalization

Ensure newly added domain files use consistent i18n strategy (string keys vs inline text) to avoid duplicated wording and encoding drift.

