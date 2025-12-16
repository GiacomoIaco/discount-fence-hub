-- Migration: Extended Community Fields
-- Adds fields for start/end dates, rep assignments, and crew priorities

-- Start and end dates for community lifecycle
ALTER TABLE communities ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS end_date DATE;

-- Default sales rep assignment
ALTER TABLE communities ADD COLUMN IF NOT EXISTS default_rep_id UUID REFERENCES user_profiles(id);

-- Priority crews (array of crew IDs for scheduling preference)
ALTER TABLE communities ADD COLUMN IF NOT EXISTS priority_crew_ids UUID[] DEFAULT '{}';

-- Priority project managers (array of user profile IDs)
ALTER TABLE communities ADD COLUMN IF NOT EXISTS priority_pm_ids UUID[] DEFAULT '{}';

-- Add comment documenting the status options
COMMENT ON COLUMN communities.status IS 'Status options: new (no jobs yet), onboarding, active, inactive, completed';

-- Create index for rep assignment lookups
CREATE INDEX IF NOT EXISTS idx_communities_default_rep ON communities(default_rep_id) WHERE default_rep_id IS NOT NULL;
