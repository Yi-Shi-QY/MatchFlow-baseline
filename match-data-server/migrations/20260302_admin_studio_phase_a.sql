-- MatchFlow Server 2.0 - Web Admin Studio Phase A
-- Date: 2026-03-02
-- Purpose:
-- 1) Add versioned catalog revision tables for visual governance domains.
-- 2) Add validation run and release record tables.
-- 3) Seed permission codes for catalog editing and release workflows.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==========================================================
-- 1) Revision Tables
-- ==========================================================

CREATE TABLE IF NOT EXISTS datasource_revisions (
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
    CONSTRAINT datasource_revisions_status_check CHECK (status IN ('draft', 'validated', 'published', 'deprecated')),
    CONSTRAINT datasource_revisions_channel_check CHECK (channel IN ('internal', 'beta', 'stable'))
);

CREATE TABLE IF NOT EXISTS planning_template_revisions (
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
    CONSTRAINT planning_template_revisions_status_check CHECK (status IN ('draft', 'validated', 'published', 'deprecated')),
    CONSTRAINT planning_template_revisions_channel_check CHECK (channel IN ('internal', 'beta', 'stable'))
);

CREATE TABLE IF NOT EXISTS animation_template_revisions (
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
    CONSTRAINT animation_template_revisions_status_check CHECK (status IN ('draft', 'validated', 'published', 'deprecated')),
    CONSTRAINT animation_template_revisions_channel_check CHECK (channel IN ('internal', 'beta', 'stable'))
);

CREATE TABLE IF NOT EXISTS agent_revisions (
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
    CONSTRAINT agent_revisions_status_check CHECK (status IN ('draft', 'validated', 'published', 'deprecated')),
    CONSTRAINT agent_revisions_channel_check CHECK (channel IN ('internal', 'beta', 'stable'))
);

CREATE TABLE IF NOT EXISTS skill_revisions (
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
    CONSTRAINT skill_revisions_status_check CHECK (status IN ('draft', 'validated', 'published', 'deprecated')),
    CONSTRAINT skill_revisions_channel_check CHECK (channel IN ('internal', 'beta', 'stable'))
);

CREATE INDEX IF NOT EXISTS idx_datasource_revisions_lookup
    ON datasource_revisions(tenant_id, item_id, status, channel, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_planning_template_revisions_lookup
    ON planning_template_revisions(tenant_id, item_id, status, channel, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_animation_template_revisions_lookup
    ON animation_template_revisions(tenant_id, item_id, status, channel, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_revisions_lookup
    ON agent_revisions(tenant_id, item_id, status, channel, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_revisions_lookup
    ON skill_revisions(tenant_id, item_id, status, channel, updated_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_datasource_revisions_modtime') THEN
        CREATE TRIGGER update_datasource_revisions_modtime
        BEFORE UPDATE ON datasource_revisions
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_planning_template_revisions_modtime') THEN
        CREATE TRIGGER update_planning_template_revisions_modtime
        BEFORE UPDATE ON planning_template_revisions
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_animation_template_revisions_modtime') THEN
        CREATE TRIGGER update_animation_template_revisions_modtime
        BEFORE UPDATE ON animation_template_revisions
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_revisions_modtime') THEN
        CREATE TRIGGER update_agent_revisions_modtime
        BEFORE UPDATE ON agent_revisions
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_skill_revisions_modtime') THEN
        CREATE TRIGGER update_skill_revisions_modtime
        BEFORE UPDATE ON skill_revisions
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

-- ==========================================================
-- 2) Validation and Release Tables
-- ==========================================================

CREATE TABLE IF NOT EXISTS validation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    run_type VARCHAR(64) NOT NULL,
    domain VARCHAR(64) NOT NULL,
    scope_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    logs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT validation_runs_type_check CHECK (run_type IN ('catalog_validate', 'pre_publish', 'post_publish')),
    CONSTRAINT validation_runs_domain_check CHECK (domain IN ('datasource', 'planning_template', 'animation_template', 'agent', 'skill')),
    CONSTRAINT validation_runs_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled'))
);

CREATE TABLE IF NOT EXISTS release_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain VARCHAR(64) NOT NULL,
    item_id VARCHAR(128) NOT NULL,
    from_version VARCHAR(64),
    to_version VARCHAR(64) NOT NULL,
    channel VARCHAR(32) NOT NULL DEFAULT 'internal',
    action VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'succeeded',
    notes TEXT,
    validation_run_id UUID REFERENCES validation_runs(id) ON DELETE SET NULL,
    triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT release_records_domain_check CHECK (domain IN ('datasource', 'planning_template', 'animation_template', 'agent', 'skill')),
    CONSTRAINT release_records_channel_check CHECK (channel IN ('internal', 'beta', 'stable')),
    CONSTRAINT release_records_action_check CHECK (action IN ('publish', 'rollback')),
    CONSTRAINT release_records_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled'))
);

CREATE INDEX IF NOT EXISTS idx_validation_runs_lookup
    ON validation_runs(tenant_id, domain, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_records_lookup
    ON release_records(tenant_id, domain, item_id, channel, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_validation_runs_modtime') THEN
        CREATE TRIGGER update_validation_runs_modtime
        BEFORE UPDATE ON validation_runs
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_release_records_modtime') THEN
        CREATE TRIGGER update_release_records_modtime
        BEFORE UPDATE ON release_records
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

-- ==========================================================
-- 3) Permission Seed for Studio Governance
-- ==========================================================

INSERT INTO permissions (code, name, description, is_system, is_active) VALUES
('catalog:datasource:edit', 'Catalog Datasource Edit', 'Edit datasource catalog entries', TRUE, TRUE),
('catalog:template:edit', 'Catalog Template Edit', 'Edit planning template catalog entries', TRUE, TRUE),
('catalog:animation:edit', 'Catalog Animation Edit', 'Edit animation template catalog entries', TRUE, TRUE),
('catalog:agent:edit', 'Catalog Agent Edit', 'Edit agent catalog entries', TRUE, TRUE),
('catalog:skill:edit', 'Catalog Skill Edit', 'Edit skill catalog entries', TRUE, TRUE),
('validate:run', 'Validation Run', 'Trigger validation and test runs', TRUE, TRUE),
('release:publish', 'Release Publish', 'Publish revisions to release channels', TRUE, TRUE),
('release:rollback', 'Release Rollback', 'Rollback released revisions', TRUE, TRUE),
('release:read', 'Release Read', 'Read release history and records', TRUE, TRUE),
('audit:read', 'Audit Read', 'Read governance and security audit logs', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'catalog:datasource:edit',
    'catalog:template:edit',
    'catalog:animation:edit',
    'catalog:agent:edit',
    'catalog:skill:edit',
    'validate:run',
    'release:publish',
    'release:rollback',
    'release:read',
    'audit:read'
)
WHERE r.code IN ('super_admin', 'tenant_admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('validate:run', 'release:read', 'audit:read')
WHERE r.code = 'analyst'
ON CONFLICT (role_id, permission_id) DO NOTHING;
