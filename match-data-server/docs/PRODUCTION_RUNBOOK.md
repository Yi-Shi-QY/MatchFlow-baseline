# Match Data Server Production Runbook

## Goal
Bring the server and Admin Studio web into a production-ready state with repeatable commands.

## 1. Initialize production env files
Run this once to generate local files:

```bash
npm run env:prod:init
```

Generated files:
- `.env.production`
- `admin-studio-web/.env.production`

If you need to regenerate and overwrite existing files:

```bash
npm run env:prod:init -- --force
```

## 2. Fill required production values
Update `.env.production`:
- `DATABASE_URL` with production PostgreSQL connection
- `CORS_ALLOWED_ORIGINS` with explicit allowlist (no wildcard)
- `API_KEY`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` with strong secrets
- `DEEPSEEK_API_KEY` if live model preview endpoints are required

Update `admin-studio-web/.env.production`:
- `VITE_MATCH_DATA_SERVER_URL` with production API URL
- `VITE_MATCH_DATA_API_KEY` with server API key used by Admin Studio

## 3. Verify backend production config
Run strict checks against `.env.production`:

```bash
npm run preflight:prod:file
npm run test:prod-ready:file
```

Or run both in one command:

```bash
npm run verify:prod:file
```

## 4. Verify Admin Studio web
Run static checks and production build:

```bash
npm run admin-web:lint
npm run admin-web:build
```

Optional end-to-end regression:

```bash
npm run admin-web:e2e
```

## 5. Start services
Database:

```bash
npm run db:up
```

Server:

```bash
npm run start
```

Notes:
- `docker/init/00-bootstrap.sh` runs `schema.sql` and `migrations/*.sql` on first database initialization.
- If you reuse an existing database volume, apply new migrations manually as needed.
