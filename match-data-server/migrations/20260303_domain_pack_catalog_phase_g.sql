-- MatchFlow Server 2.0 - Domain Pack Catalog Phase G
-- Date: 2026-03-03
-- Purpose:
-- 1) Add domain_pack revision table for catalog/release lifecycle.
-- 2) Extend validation/release domain constraints to include domain_pack.
-- 3) Seed catalog:domain:edit permission for governance workflows.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS domain_pack_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_id VARCHAR(128) NOT NULL,
    version VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    channel VARCHAR(32) NOT NULL DEFAULT 'internal',
    manifest_json JSONB NOT NULL,
    checksum VARCHAR(128),
    validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, item_id, version),
    CONSTRAINT domain_pack_revisions_status_check CHECK (status IN ('draft', 'validated', 'published', 'deprecated')),
    CONSTRAINT domain_pack_revisions_channel_check CHECK (channel IN ('internal', 'beta', 'stable'))
);

CREATE INDEX IF NOT EXISTS idx_domain_pack_revisions_lookup
    ON domain_pack_revisions(tenant_id, item_id, status, channel, updated_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_domain_pack_revisions_modtime') THEN
        CREATE TRIGGER update_domain_pack_revisions_modtime
        BEFORE UPDATE ON domain_pack_revisions
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'validation_runs') THEN
        ALTER TABLE validation_runs DROP CONSTRAINT IF EXISTS validation_runs_domain_check;
        ALTER TABLE validation_runs
            ADD CONSTRAINT validation_runs_domain_check
            CHECK (domain IN ('datasource', 'planning_template', 'animation_template', 'agent', 'skill', 'domain_pack'));
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'release_records') THEN
        ALTER TABLE release_records DROP CONSTRAINT IF EXISTS release_records_domain_check;
        ALTER TABLE release_records
            ADD CONSTRAINT release_records_domain_check
            CHECK (domain IN ('datasource', 'planning_template', 'animation_template', 'agent', 'skill', 'domain_pack'));
    END IF;
END;
$$;

INSERT INTO permissions (code, name, description, is_system, is_active)
VALUES ('catalog:domain:edit', 'Catalog Domain Pack Edit', 'Edit domain pack catalog entries', TRUE, TRUE)
ON CONFLICT (code)
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = TRUE;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'catalog:domain:edit'
WHERE r.code IN ('super_admin', 'tenant_admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;
