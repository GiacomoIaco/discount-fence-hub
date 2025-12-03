-- Migration: Add notes column to labor_codes table
-- This adds a notes field for additional instructions or documentation

-- Add notes column to labor_codes table
ALTER TABLE labor_codes
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN labor_codes.notes IS 'Additional notes or instructions for this labor code';
