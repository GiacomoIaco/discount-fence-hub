-- Migration 034: Simplify Annual Targets to Single Field
-- Convert from metric_name + target_value to single target_text field

-- 1. Add new target_text column
ALTER TABLE initiative_annual_targets
ADD COLUMN IF NOT EXISTS target_text TEXT;

-- 2. Migrate existing data: combine metric_name and target_value
UPDATE initiative_annual_targets
SET target_text =
  CASE
    WHEN target_value IS NOT NULL AND target_value != '' THEN
      metric_name || ': ' || target_value
    ELSE
      metric_name
  END
WHERE target_text IS NULL;

-- 3. Make target_text NOT NULL after migration
ALTER TABLE initiative_annual_targets
ALTER COLUMN target_text SET NOT NULL;

-- 4. Drop old columns (keeping them temporarily commented out for safety)
-- ALTER TABLE initiative_annual_targets DROP COLUMN metric_name;
-- ALTER TABLE initiative_annual_targets DROP COLUMN target_value;
-- ALTER TABLE initiative_annual_targets DROP COLUMN unit;

-- 5. Update unique constraint to use target_text
ALTER TABLE initiative_annual_targets
DROP CONSTRAINT IF EXISTS initiative_annual_targets_initiative_id_year_metric_name_key;

-- Note: Not adding unique constraint on target_text to allow duplicate targets if needed
-- Users can add multiple similar targets (e.g., "Increase revenue by 10%" for different quarters)

-- 6. Update comment
COMMENT ON COLUMN initiative_annual_targets.target_text IS 'Complete target description in single field (e.g., "Achieve $7M revenue at 27%+ margins")';
