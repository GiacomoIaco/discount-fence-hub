-- Backfill completed_at for existing completed requests
-- For requests that are already completed but have no completed_at timestamp,
-- we'll use updated_at as the best approximation of when they were completed.

-- Update completed requests that have NULL completed_at
UPDATE requests
SET completed_at = COALESCE(updated_at, created_at)
WHERE stage = 'completed'
  AND completed_at IS NULL;

-- Update archived requests that have NULL completed_at
UPDATE requests
SET completed_at = COALESCE(updated_at, created_at)
WHERE stage = 'archived'
  AND completed_at IS NULL;

-- Show count of affected rows
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM requests
  WHERE stage IN ('completed', 'archived')
    AND completed_at IS NOT NULL;

  RAISE NOTICE 'Backfilled completed_at for % completed/archived requests', updated_count;
END $$;
