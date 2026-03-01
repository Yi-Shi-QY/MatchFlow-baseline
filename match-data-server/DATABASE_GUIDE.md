# Match Data Server Database Guide

This document explains how to move from in-memory mock data to PostgreSQL.

## 1. Why PostgreSQL

- Stable production database
- Good JSON support (`JSONB`) for flexible fields (`stats`, `odds`)
- Easy indexing for query performance

## 2. Core Schema

Main tables:

- `teams`
- `matches`

Schema file:

- `match-data-server/schema.sql`

## 3. Setup

### Option A: Docker

```bash
cd match-data-server
docker-compose up -d
```

### Option B: Existing PostgreSQL

Set `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

## 4. Initialize Schema

You can initialize tables through admin endpoint:

```bash
curl -X POST http://localhost:3001/admin/init \
  -H "Authorization: Bearer <API_KEY>"
```

Or run SQL directly:

```bash
psql -h <host> -U <user> -d <db> -f schema.sql
```

## 5. Data Ingestion Pattern

Recommended flow:

1. Upsert teams via `POST /admin/teams`
2. Upsert matches via `POST /admin/matches`
3. Update live score/status via `PUT /admin/matches/:id/score`

Example script:

- `match-data-server/scripts/push_data_example.js`

## 6. Production Recommendations

- Keep `API_KEY` strong and private
- Put server behind HTTPS reverse proxy
- Add request rate limiting for admin APIs
- Add periodic DB backup
- Add read endpoint cache for high traffic (`/matches`)
