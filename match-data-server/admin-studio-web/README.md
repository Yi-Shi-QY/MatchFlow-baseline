# MatchFlow Admin Studio Web

Standalone web admin console for Server 2.0 governance workflows.

This app is intentionally separated from the MatchFlow mobile/client app.

## Scope

1. Catalog editing:
   - datasource
   - planning_template
   - animation_template
   - agent
   - skill
2. Validation workflow:
   - run validation
   - inspect run result
3. Release workflow:
   - publish
   - rollback
   - release history

## Run

From `match-data-server`:

```bash
npm run admin-web:dev
```

Directly from this folder:

```bash
npm run dev
```

## Browser E2E

Prerequisites:

1. PostgreSQL container is running (`cd .. && npm run db:up`).
2. Playwright browser is installed once:

```bash
npm run test:e2e:install
```

Run datasource governance lifecycle E2E:

```bash
# from match-data-server
npm run admin-web:e2e

# or from this folder
npm run test:e2e
```

## Environment

Optional Vite env values:

1. `VITE_MATCH_DATA_SERVER_URL`
2. `VITE_MATCH_DATA_API_KEY`
3. `E2E_MATCH_DATA_SERVER_URL` (optional override for Playwright)
4. `E2E_MATCH_DATA_API_KEY` (optional override for Playwright)

The app reads these as defaults and can persist overrides in local storage key:

1. `matchflow_admin_studio_settings`
