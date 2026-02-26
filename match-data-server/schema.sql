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
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_league ON matches(league_name);

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
