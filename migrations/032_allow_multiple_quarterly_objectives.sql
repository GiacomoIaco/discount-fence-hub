-- Migration 032: Allow Multiple Quarterly Objectives
-- Remove unique constraint to allow multiple objectives per initiative per quarter

-- Drop the unique constraint
ALTER TABLE initiative_quarterly_objectives
DROP CONSTRAINT IF EXISTS initiative_quarterly_objectives_initiative_id_year_quarter_key;

-- Add sort_order column for ordering objectives within a quarter
ALTER TABLE initiative_quarterly_objectives
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_quarterly_obj_init_year_qtr_sort
  ON initiative_quarterly_objectives(initiative_id, year, quarter, sort_order);

COMMENT ON COLUMN initiative_quarterly_objectives.sort_order IS 'Order of objectives within a quarter for an initiative';
