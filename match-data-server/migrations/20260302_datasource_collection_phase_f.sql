-- Phase F: Datasource collection governance (collect -> confirm -> release)

CREATE TABLE IF NOT EXISTS datasource_collectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_id VARCHAR(128) NOT NULL,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(64) NOT NULL DEFAULT 'match_snapshot',
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    schedule_cron VARCHAR(128),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_run_status VARCHAR(32) NOT NULL DEFAULT 'idle',
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT datasource_collectors_provider_check CHECK (provider IN ('match_snapshot', 'manual_import')),
    CONSTRAINT datasource_collectors_last_status_check CHECK (last_run_status IN ('idle', 'running', 'succeeded', 'failed')),
    CONSTRAINT datasource_collectors_name_unique UNIQUE (tenant_id, source_id, name)
);

CREATE TABLE IF NOT EXISTS datasource_collection_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    collector_id UUID NOT NULL REFERENCES datasource_collectors(id) ON DELETE CASCADE,
    source_id VARCHAR(128) NOT NULL,
    trigger_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    request_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT datasource_collection_runs_trigger_check CHECK (trigger_type IN ('manual', 'scheduled', 'retry')),
    CONSTRAINT datasource_collection_runs_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled'))
);

CREATE TABLE IF NOT EXISTS datasource_collection_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    collector_id UUID NOT NULL REFERENCES datasource_collectors(id) ON DELETE CASCADE,
    run_id UUID REFERENCES datasource_collection_runs(id) ON DELETE SET NULL,
    source_id VARCHAR(128) NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    record_count INTEGER NOT NULL DEFAULT 0,
    content_hash VARCHAR(128),
    confirmation_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    confirmation_notes TEXT,
    confirmed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    release_status VARCHAR(32) NOT NULL DEFAULT 'draft',
    release_channel VARCHAR(32),
    released_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    released_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT datasource_collection_snapshots_confirmation_check CHECK (confirmation_status IN ('pending', 'confirmed', 'rejected')),
    CONSTRAINT datasource_collection_snapshots_release_status_check CHECK (release_status IN ('draft', 'released', 'deprecated')),
    CONSTRAINT datasource_collection_snapshots_release_channel_check CHECK (
        release_channel IS NULL OR release_channel IN ('internal', 'beta', 'stable')
    )
);

CREATE INDEX IF NOT EXISTS idx_datasource_collectors_lookup
    ON datasource_collectors(tenant_id, source_id, is_enabled, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_datasource_collection_runs_lookup
    ON datasource_collection_runs(tenant_id, collector_id, source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_datasource_collection_runs_status
    ON datasource_collection_runs(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_datasource_collection_snapshots_lookup
    ON datasource_collection_snapshots(tenant_id, source_id, confirmation_status, release_status, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_datasource_collectors_modtime'
    ) THEN
        CREATE TRIGGER update_datasource_collectors_modtime
        BEFORE UPDATE ON datasource_collectors
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_datasource_collection_runs_modtime'
    ) THEN
        CREATE TRIGGER update_datasource_collection_runs_modtime
        BEFORE UPDATE ON datasource_collection_runs
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_datasource_collection_snapshots_modtime'
    ) THEN
        CREATE TRIGGER update_datasource_collection_snapshots_modtime
        BEFORE UPDATE ON datasource_collection_snapshots
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;
