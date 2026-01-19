-- ============================================
-- Migration 265b: Direct fix for is_lost
-- ============================================
-- Instead of recreating the function and recomputing everything,
-- directly update the is_lost column based on quote statuses

-- First, set all is_lost to FALSE (reset)
UPDATE jobber_api_opportunities SET is_lost = FALSE WHERE id IS NOT NULL;

-- Now set is_lost = TRUE for opportunities where:
-- 1. At least one quote is archived
-- 2. No quotes are converted (is_won = FALSE)
UPDATE jobber_api_opportunities o
SET is_lost = TRUE
WHERE o.is_won = FALSE
  AND EXISTS (
    SELECT 1 FROM jobber_api_quotes q
    WHERE q.jobber_id = ANY(o.quote_jobber_ids)
      AND q.status = 'archived'
  );

-- Also update is_pending to be consistent
UPDATE jobber_api_opportunities
SET is_pending = NOT is_won AND NOT is_lost
WHERE id IS NOT NULL;

-- Verify the fix
SELECT
    COUNT(*) FILTER (WHERE is_won) AS won_count,
    COUNT(*) FILTER (WHERE is_lost) AS lost_count,
    COUNT(*) FILTER (WHERE is_pending) AS pending_count,
    COUNT(*) AS total_count
FROM jobber_api_opportunities;
