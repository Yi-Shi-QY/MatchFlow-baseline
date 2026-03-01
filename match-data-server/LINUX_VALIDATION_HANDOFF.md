# Match Data Server Linux Validation Handoff

Last updated: 2026-03-01

## 1. Current implementation status

Completed code work:

1. Client integrates server planning config before analysis starts.
2. Server is modularized (`routes/services/repositories/middlewares/mock`).
3. Server provides analysis config APIs:
   - `GET /analysis/config/match/:id`
   - `POST /analysis/config/resolve`
4. Server provides hub manifest APIs with all fallback aliases:
   - `/hub/{kind}s/:id`
   - `/hub/{kind}/:id`
   - `/extensions/{kind}s/:id`
   - `/extensions/{kind}/:id`
5. Server supports extension lifecycle admin APIs:
   - `GET /admin/extensions`
   - `POST /admin/extensions`
   - `PUT /admin/extensions/:kind/:id/:version`
   - `POST /admin/extensions/publish`
6. Schema includes `extension_manifests` table, indexes, and update trigger.

Relevant commits:

1. `4b3f31b` feat(analysis): integrate server planning config and modularize match-data-server
2. `9d985ef` fix(server): allow mock-mode startup without local cors/pg installs

## 2. Windows-side validation results (already done)

Validated in mock mode (`db_connected=false`):

1. `GET /health`
2. `GET /matches`
3. `GET /analysis/config/match/m2`
4. `GET /hub/templates/live_market_pro`
5. `GET /admin/extensions`

Validated hub fallback compatibility (all passed):

1. Template: 4 path variants
2. Agent: 4 path variants
3. Skill: 4 path variants

Total hub endpoint checks passed: 12/12.

Validated planning payload contract:

1. `planning.mode = template`
2. `planning.templateId = live_market_pro`
3. `requiredAgents` includes `momentum_agent`
4. `requiredSkills` includes `select_plan_template_v2`
5. `hub.baseUrl` + `hub.autoInstall=true`

## 3. Why full DB validation is pending

Pending item:

1. `POST /admin/init` with real PostgreSQL connection and schema migration verification.

Blocked on Windows environment:

1. Docker daemon unavailable (Docker Desktop Linux engine pipe not available).
2. Not using WSL2 docker for this project in current setup.

## 4. Linux continuation checklist

Run these steps in Linux environment:

1. Start PostgreSQL (Docker or host service).
2. Configure `.env` in `match-data-server`:
   - `PORT=3001`
   - `API_KEY=<your-key>`
   - `DATABASE_URL=postgresql://...`
3. Install server dependencies:
   - `cd match-data-server`
   - `npm install`
4. Start server:
   - `npm run dev`
5. Initialize schema:
   - `curl -X POST http://127.0.0.1:3001/admin/init -H "Authorization: Bearer <API_KEY>"`
6. Verify extension schema objects in PostgreSQL:
   - table `extension_manifests`
   - index `idx_extension_manifest_version`
   - index `idx_extension_manifest_lookup`
   - trigger `update_extension_manifests_modtime`
7. Validate extension admin lifecycle:
   - create via `POST /admin/extensions`
   - publish via `POST /admin/extensions/publish`
   - verify read via `/hub/...` endpoints
8. Validate client auto-install full loop with a clean extension store:
   - ensure missing `momentum_agent` and `select_plan_template_v2`
   - start analysis on a live match
   - confirm manifests are fetched and installed

## 5. Suggested quick smoke commands (Linux)

```bash
curl -s http://127.0.0.1:3001/health

curl -s http://127.0.0.1:3001/matches \
  -H "Authorization: Bearer ${API_KEY}"

curl -s http://127.0.0.1:3001/analysis/config/match/m2 \
  -H "Authorization: Bearer ${API_KEY}"

curl -s http://127.0.0.1:3001/hub/templates/live_market_pro \
  -H "Authorization: Bearer ${API_KEY}"

curl -s -X POST http://127.0.0.1:3001/admin/init \
  -H "Authorization: Bearer ${API_KEY}"
```

## 6. Notes

1. The server now supports mock mode startup even if `pg` is unavailable, but DB lifecycle endpoints still require real DB connection.
2. Once Linux DB validation is complete, update this file with actual SQL checks and endpoint outputs.

