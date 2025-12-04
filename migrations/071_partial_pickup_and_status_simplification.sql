-- Migration: Partial Pickup and Status Simplification
-- Adds partial_pickup flag and removes "loaded" status (merged into "completed")

-- Add partial pickup columns
ALTER TABLE bom_projects
ADD COLUMN IF NOT EXISTS partial_pickup BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS partial_pickup_notes TEXT;

-- Comments
COMMENT ON COLUMN bom_projects.partial_pickup IS 'True if only part of the material was picked up, more remains at yard';
COMMENT ON COLUMN bom_projects.partial_pickup_notes IS 'Required notes explaining what material remains when partial_pickup is true';

-- Update any existing "loaded" status to "completed" (status simplification)
UPDATE bom_projects
SET status = 'completed'
WHERE status = 'loaded';

-- Index for finding projects with pending partial pickups
CREATE INDEX IF NOT EXISTS idx_bom_projects_partial_pickup
ON bom_projects(partial_pickup)
WHERE partial_pickup = true;
