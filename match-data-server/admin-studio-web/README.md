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

## Environment

Optional Vite env values:

1. `VITE_MATCH_DATA_SERVER_URL`
2. `VITE_MATCH_DATA_API_KEY`

The app reads these as defaults and can persist overrides in local storage key:

1. `matchflow_admin_studio_settings`
