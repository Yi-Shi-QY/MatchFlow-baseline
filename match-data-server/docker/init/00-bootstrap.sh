#!/bin/sh
set -e

echo "[bootstrap] Applying schema.sql"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /bootstrap/schema.sql

if [ -d /bootstrap/migrations ]; then
  for migration in /bootstrap/migrations/*.sql; do
    if [ -f "$migration" ]; then
      echo "[bootstrap] Applying migration: $(basename "$migration")"
      psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$migration"
    fi
  done
fi

echo "[bootstrap] Database initialization complete"
