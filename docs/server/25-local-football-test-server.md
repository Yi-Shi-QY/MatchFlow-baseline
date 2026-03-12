# Local Football Test Server

This guide sets up a small local football datasource server for MatchFlow client testing.

## Goal

Use the existing `match-data-server` with:

1. PostgreSQL in Docker
2. Seeded football matches for `upcoming`, `live`, and `finished`
3. A local server process for client integration checks

## Commands

From `match-data-server/`:

```bash
npm install
npm run db:up
npm run seed:football:test
npm run local:football
```

Open another terminal in `match-data-server/` and run:

```bash
npm run test:football:smoke
```

## What Gets Seeded

The seed script writes a reusable football dataset with:

1. Four matches across Premier League, La Liga, Serie A, and Bundesliga
2. `upcoming`, `live`, and `finished` states
3. Stats and odds payloads
4. `source_context` metadata for `domainId`, selected sources, and planning hints

The seed is rerunnable because it uses fixed UUIDs and upserts.

## Default Local Settings

`npm run local:football` starts the server with these defaults when env vars are not already set:

1. `PORT=3001`
2. `API_KEY=matchflow-local-football-test-key-20260311`
3. `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/matchflow`

## Client Verification

Expected client-compatible endpoints:

1. `GET /matches?limit=1`
2. `GET /matches/live`
3. `GET /analysis/config/match/:id`

For a quick manual check:

```bash
curl http://127.0.0.1:3001/matches?limit=3 ^
  -H "Authorization: Bearer matchflow-local-football-test-key-20260311"
```

## Android Notes

For Android Studio emulator:

1. server url: `http://10.0.2.2:3001`
2. api key: `matchflow-local-football-test-key-20260311`

For a real phone on the same LAN:

1. use your host machine LAN IP instead of `127.0.0.1`
2. keep the same API key

## Client Auto Preset

To make the client default to this local datasource in local builds, add these values to `.env.local` in the project root:

```bash
VITE_MATCHFLOW_LOCAL_TEST_SERVER_PRESET=1
VITE_MATCHFLOW_LOCAL_TEST_SERVER_URL=http://127.0.0.1:3001
VITE_MATCHFLOW_LOCAL_TEST_SERVER_ANDROID_URL=http://10.0.2.2:3001
VITE_MATCHFLOW_LOCAL_TEST_SERVER_API_KEY=matchflow-local-football-test-key-20260311
```

The Settings page also includes a local football test server preset button that fills and saves the same values for the current runtime.

## Reset

If you want a clean database:

```bash
npm run db:reset
npm run db:up
npm run seed:football:test
```
