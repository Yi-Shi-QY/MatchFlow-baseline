-- Enable UUID extension (optional, but recommended for IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Teams Table
-- Stores static information about football clubs/teams
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(512),
    -- Stores recent form as a JSON array, e.g., '["W", "L", "D", "W", "W"]'
    -- Or simple string "WLDWW" depending on preference. JSONB is more flexible.
    recent_form JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Matches Table
-- Stores the schedule and results of matches
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_name VARCHAR(255) NOT NULL,
    match_date TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Status: 'upcoming', 'live', 'finished', 'postponed'
    status VARCHAR(50) NOT NULL DEFAULT 'upcoming',
    
    home_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    
    -- Stores detailed match statistics as JSONB for flexibility
    -- Structure example:
    -- {
    --   "possession": { "home": 50, "away": 50 },
    --   "shots": { "home": 10, "away": 5 },
    --   "shotsOnTarget": { "home": 4, "away": 2 }
    -- }
    match_stats JSONB DEFAULT '{}'::jsonb,

    -- Stores odds data
    -- Structure example:
    -- {
    --   "had": { "h": 1.5, "d": 3.5, "a": 5.0 },
    --   "hhad": { "h": 2.0, "d": 3.2, "a": 3.5, "goalline": -1 }
    -- }
    odds JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tenants Table
-- Root scope for user/account isolation
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(128) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Users Table
-- Identity records for account-based authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    username VARCHAR(128) NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    password_hash TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, username),
    UNIQUE (tenant_id, email)
);

-- 5. Roles Table
-- RBAC role definitions
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(128) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Permissions Table
-- Permission namespace entries (e.g., datasource:use:*)
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(128) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. User Roles Table
-- Role bindings per user
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, role_id)
);

-- 8. Role Permissions Table
-- Permission bindings per role
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (role_id, permission_id)
);

-- 9. Sessions Table
-- Refresh-token lifecycle tracking
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    user_agent TEXT,
    ip_address VARCHAR(128),
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Audit Logs Table
-- Immutable records for security-sensitive operations
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(128),
    target_id VARCHAR(128),
    before_state JSONB,
    after_state JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Extension Manifests Table
-- Stores versioned agent/skill/template manifests for hub distribution
CREATE TABLE IF NOT EXISTS extension_manifests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kind VARCHAR(32) NOT NULL,
    extension_id VARCHAR(128) NOT NULL,
    version VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    manifest_json JSONB NOT NULL,
    channel VARCHAR(32) NOT NULL DEFAULT 'stable',
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    checksum VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_league ON matches(league_name);
CREATE INDEX IF NOT EXISTS idx_users_lookup_username ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_lookup_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_manifest_version ON extension_manifests(kind, extension_id, version);
CREATE INDEX IF NOT EXISTS idx_extension_manifest_lookup ON extension_manifests(kind, extension_id, channel, status);

-- Trigger to automatically update 'updated_at'
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_teams_modtime BEFORE UPDATE ON teams FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_matches_modtime BEFORE UPDATE ON matches FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_tenants_modtime'
    ) THEN
        CREATE TRIGGER update_tenants_modtime
        BEFORE UPDATE ON tenants
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_users_modtime'
    ) THEN
        CREATE TRIGGER update_users_modtime
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_roles_modtime'
    ) THEN
        CREATE TRIGGER update_roles_modtime
        BEFORE UPDATE ON roles
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_permissions_modtime'
    ) THEN
        CREATE TRIGGER update_permissions_modtime
        BEFORE UPDATE ON permissions
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_user_roles_modtime'
    ) THEN
        CREATE TRIGGER update_user_roles_modtime
        BEFORE UPDATE ON user_roles
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_role_permissions_modtime'
    ) THEN
        CREATE TRIGGER update_role_permissions_modtime
        BEFORE UPDATE ON role_permissions
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_sessions_modtime'
    ) THEN
        CREATE TRIGGER update_sessions_modtime
        BEFORE UPDATE ON sessions
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_extension_manifests_modtime'
    ) THEN
        CREATE TRIGGER update_extension_manifests_modtime
        BEFORE UPDATE ON extension_manifests
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END;
$$;

-- Seed baseline tenant/roles/permissions for auth onboarding
INSERT INTO tenants (id, slug, name, status) VALUES
('00000000-0000-0000-0000-000000000001', 'default', 'Default Tenant', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO roles (code, name, description, is_system, is_active) VALUES
('super_admin', 'Super Admin', 'Global administrator with full privileges', TRUE, TRUE),
('tenant_admin', 'Tenant Admin', 'Tenant-level administrator', TRUE, TRUE),
('analyst', 'Analyst', 'User can run analysis templates and data sources', TRUE, TRUE),
('viewer', 'Viewer', 'Read-only user with restricted capabilities', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description, is_system, is_active) VALUES
('admin:*', 'Admin Wildcard', 'All administrative privileges', TRUE, TRUE),
('datasource:use:*', 'Datasource Wildcard', 'Access to all data sources', TRUE, TRUE),
('template:use:*', 'Template Wildcard', 'Access to all analysis templates', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('admin:*', 'datasource:use:*', 'template:use:*')
WHERE r.code = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('admin:*', 'datasource:use:*', 'template:use:*')
WHERE r.code = 'tenant_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('datasource:use:*', 'template:use:*')
WHERE r.code = 'analyst'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================
-- Seed Data (Optional - For Testing)
-- =============================================

-- Insert Teams
INSERT INTO teams (id, name, logo_url, recent_form) VALUES 
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Arsenal', 'https://media.api-sports.io/football/teams/42.png', '["W", "W", "W", "W", "W"]'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Chelsea', 'https://media.api-sports.io/football/teams/49.png', '["L", "D", "W", "L", "D"]'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Real Madrid', 'https://media.api-sports.io/football/teams/541.png', '["W", "D", "W", "W", "L"]'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Barcelona', 'https://media.api-sports.io/football/teams/529.png', '["W", "W", "W", "W", "W"]');

-- Insert Matches
INSERT INTO matches (league_name, match_date, status, home_team_id, away_team_id, home_score, away_score, match_stats) VALUES
(
    'Premier League', 
    NOW() + INTERVAL '1 day', 
    'upcoming', 
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 
    0, 0, 
    '{"possession": {"home": 50, "away": 50}}'
),
(
    'La Liga', 
    NOW(), 
    'live', 
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 
    1, 1, 
    '{"possession": {"home": 48, "away": 52}, "shots": {"home": 15, "away": 14}}'
);
