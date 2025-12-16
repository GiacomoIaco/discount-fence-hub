-- Migration: Add context_label to mc_contacts
-- Shows additional context like community name, property address
-- Example: "Perry Homes" (company) + "Six Creek Ranch" (context)

ALTER TABLE mc_contacts
ADD COLUMN IF NOT EXISTS context_label TEXT;

-- Add comment for documentation
COMMENT ON COLUMN mc_contacts.context_label IS 'Additional context (community name, property address, etc.)';
