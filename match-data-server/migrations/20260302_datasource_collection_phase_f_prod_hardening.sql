-- Phase F production hardening: snapshot hash lookup for import deduplication

CREATE INDEX IF NOT EXISTS idx_datasource_collection_snapshots_hash_lookup
    ON datasource_collection_snapshots(tenant_id, source_id, content_hash, created_at DESC)
    WHERE content_hash IS NOT NULL;
