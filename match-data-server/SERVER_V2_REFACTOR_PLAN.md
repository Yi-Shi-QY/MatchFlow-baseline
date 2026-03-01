# Match Data Server V2 Refactor Plan

## 1. Goals

The V2 server must support current client behavior and new extension hub workflows.

Primary goals:

1. Keep existing `/matches` client flow working.
2. Return enough context for source-aware planning recommendations.
3. Provide hub endpoints for versioned `agent/skill/template` manifests.
4. Support automatic installation of missing extensions from server hints.
5. Keep backward compatibility during migration.

## 2. Client Contract (Current Reality)

## 2.1 Match fetch contract

Current client match list call:

1. `GET /matches`
2. Header: `Authorization: Bearer <API_KEY>`
3. Response shape: `{ data: Match[] }`

Current `Match` fields consumed by UI:

1. `id`, `league`, `date`, `status`
2. `homeTeam`, `awayTeam`
3. optional `score`, `stats`, `odds`
4. optional `source`, `capabilities`

## 2.2 Planning-related fields consumed by AI runtime

Runtime reads `matchData.sourceContext`, especially:

1. `selectedSources`
2. `selectedSourceIds`
3. `capabilities`
4. `matchStatus`
5. optional `planning`
   - `mode`: `template | autonomous`
   - `templateId` or `templateType`
   - `requiredAgents: string[]`
   - `requiredSkills: string[]`
   - `hub: { baseUrl, apiKey, autoInstall }`

## 2.3 Hub manifest lookup contract

Client currently tries all of the following:

1. `/hub/{kind}s/{id}`
2. `/hub/{kind}/{id}`
3. `/extensions/{kind}s/{id}`
4. `/extensions/{kind}/{id}`

`kind in {agent, skill, template}`.

Supported response payload forms:

1. `{ "data": { ...manifest } }`
2. `{ "manifest": { ...manifest } }`
3. direct manifest object

## 3. Current Server Gap Analysis

Existing server provides:

1. Match read APIs (`/matches`, `/matches/:id`, `/matches/live`, etc.)
2. Admin write APIs (`/admin/*`)
3. Health API (`/health`)

Missing capabilities:

1. No hub endpoints for extension manifests.
2. No server-side planning recommendation engine.
3. No extension version/channel lifecycle management.
4. No manifest checksum/signature metadata.
5. No endpoint dedicated to analysis config resolution.

## 4. Proposed V2 Architecture

Refactor the server from a single file into layered modules:

1. `routes/` for HTTP routing and request validation.
2. `services/` for business logic.
3. `repositories/` for DB access.
4. `schemas/` for request/response contract validation (zod/ajv).

Suggested structure:

1. `src/routes/matches.ts`
2. `src/routes/hub.ts`
3. `src/routes/analysis-config.ts`
4. `src/services/planning-recommendation.ts`
5. `src/services/manifest-service.ts`
6. `src/repositories/match-repo.ts`
7. `src/repositories/extension-repo.ts`

## 5. API Plan

## 5.1 Keep (compatibility)

1. `GET /matches`
2. `GET /matches/:id`
3. `GET /matches/live`
4. `GET /health`

## 5.2 New planning APIs

1. `GET /analysis/config/match/:id`
   - Returns planning recommendation for one match.
2. `POST /analysis/config/resolve`
   - Input: match snapshot + selected data sources.
   - Output: recommended `sourceContext.planning`.

Recommended response fragment:

```json
{
  "data": {
    "sourceContext": {
      "planning": {
        "mode": "template",
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
}
```

## 5.3 New hub manifest APIs

Implement all aliases to match client fallback behavior:

1. `GET /hub/agents/:id`
2. `GET /hub/skills/:id`
3. `GET /hub/templates/:id`
4. `GET /hub/agent/:id`
5. `GET /hub/skill/:id`
6. `GET /hub/template/:id`
7. `GET /extensions/agents/:id`
8. `GET /extensions/skills/:id`
9. `GET /extensions/templates/:id`

## 5.4 Extension admin APIs

1. `POST /admin/extensions`
2. `PUT /admin/extensions/:kind/:id/:version`
3. `GET /admin/extensions`
4. `POST /admin/extensions/publish`

## 6. Data Model Plan

Keep existing `teams` and `matches`. Add the following tables.

## 6.1 `extension_manifests`

Columns:

1. `id` (uuid pk)
2. `kind` (`agent|skill|template`)
3. `extension_id` (string)
4. `version` (semver string)
5. `name`
6. `description`
7. `manifest_json` (jsonb)
8. `channel` (`stable|beta|internal`)
9. `status` (`draft|published|deprecated`)
10. `checksum` (sha256)
11. timestamps (`created_at`, `updated_at`, `published_at`)

Unique index:

1. `(kind, extension_id, version)`

## 6.2 `analysis_profiles`

Purpose: source-aware planning recommendation rules.

Columns:

1. `id` (uuid pk)
2. `scope_type` (`global|league|team|match`)
3. `scope_value` (nullable)
4. `priority` (int)
5. `rule_json` (jsonb)
6. `planning_json` (jsonb)
7. `enabled` (bool)
8. timestamps

## 6.3 `match_extra_context` (optional)

Columns:

1. `match_id` (fk matches.id)
2. `context_json` (jsonb)

## 7. Recommendation Engine Strategy

Priority order:

1. Match-level profile.
2. League-level profile.
3. Global profile.
4. Default fallback.

Default fallback should align with client logic:

1. Custom-only -> `autonomous`
2. Market-only -> `odds_focused`
3. Odds + stats -> `comprehensive`
4. Stats-only -> `standard`
5. Minimal data -> `basic`

Server-added value:

1. Add `requiredAgents`.
2. Add `requiredSkills`.
3. Add `hub` endpoint hint.

## 8. Important Integration Note

Current client behavior rebuilds `sourceContext` locally in `MatchDetail`.
Because of that, server-delivered planning hints are not automatically merged yet.

Recommended integration sequence:

1. V2 server provides `/analysis/config/*` first.
2. Client calls it before analysis start and merges result into `sourceContext.planning`.
3. Later, embed planning hints directly into match payload to reduce one network round trip.

## 9. Delivery Phases

## Phase 0

1. Refactor code structure.
2. Keep old API behavior unchanged.
3. Add consistent error format and trace id.

## Phase 1

1. Add `extension_manifests` table.
2. Ship read-only hub APIs.
3. Ship read-only analysis config APIs.

## Phase 2

1. Add `analysis_profiles` management.
2. Add admin publish workflow.
3. Add caching and ETag for hub endpoints.

## Phase 3

1. Add signature verification metadata.
2. Add release channels and staged rollout.
3. Add metrics, alerting, and SLA dashboards.

## 10. Definition of Done

1. Client can receive `templateId + requiredAgents + requiredSkills`.
2. Missing extensions can be auto-installed via hub.
3. Existing match/admin APIs still work.
4. API docs + manifest examples + rule examples are complete.
5. E2E scenarios pass:
   - market-only -> `odds_focused`
   - live + stats + odds -> `comprehensive`
   - forced template + missing agent -> auto install

## 11. Compatibility Payload Recommendation

Without breaking current `/matches` contract, add an optional `analysisConfig` field:

```json
{
  "data": [
    {
      "id": "m1001",
      "league": "Premier League",
      "homeTeam": { "...": "..." },
      "awayTeam": { "...": "..." },
      "status": "live",
      "source": "server-db",
      "capabilities": {
        "hasStats": true,
        "hasOdds": true,
        "hasCustom": false
      },
      "analysisConfig": {
        "planning": {
          "templateId": "comprehensive",
          "requiredAgents": ["overview", "odds", "prediction"],
          "requiredSkills": [],
          "hub": {
            "baseUrl": "https://your-server",
            "autoInstall": true
          }
        }
      }
    }
  ]
}
```

This keeps compatibility now and enables client-side merge later.

