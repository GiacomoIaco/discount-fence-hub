-- Migration 208: Add residential customer support to properties
-- Purpose: Allow properties to be linked directly to clients (without community)
-- For: Residential customers who don't have builder communities

-- 1. Add client_id column (nullable)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- 2. Make community_id nullable (was NOT NULL for builder-only model)
ALTER TABLE properties
ALTER COLUMN community_id DROP NOT NULL;

-- 3. Add index for client lookups
CREATE INDEX IF NOT EXISTS idx_properties_client ON properties(client_id);

-- 4. Add constraint: Property must have either community_id OR client_id
-- (Can have both if property is in a community but also linked to a client)
-- No constraint for now - allow flexibility during transition

-- 5. Comment
COMMENT ON COLUMN properties.client_id IS 'Direct client link for residential properties (not part of a community)';
