-- ============================================
-- MIGRATION 253: Fix Days to Quote - Use Requested Date
-- ============================================
-- Problem: days_to_quote uses assessment_date, but assessment typically happens
--          on the SAME DAY as the quote is created/sent, giving 0 days.
--
-- Fix: Use requested_date (when customer first reached out) as the start point
--      Fall back to assessment_date only if no requested_date exists

-- ============================================
-- 1. ADD REQUESTED_DATE COLUMN
-- ============================================

ALTER TABLE jobber_residential_opportunities
ADD COLUMN IF NOT EXISTS requested_date DATE;

COMMENT ON COLUMN jobber_residential_opportunities.requested_date IS 'Date customer first requested service. Primary source for days_to_quote calculation.';

-- ============================================
-- 2. DROP AND RECREATE COMPUTED COLUMNS
-- ============================================

ALTER TABLE jobber_residential_opportunities
DROP COLUMN IF EXISTS days_to_quote,
DROP COLUMN IF EXISTS speed_to_quote_bucket;

-- Recreate days_to_quote using requested_date as PRIMARY source
-- Falls back to assessment_date, then request_date (legacy)
ALTER TABLE jobber_residential_opportunities
ADD COLUMN days_to_quote INTEGER GENERATED ALWAYS AS (
    CASE
        WHEN first_quote_sent_date IS NOT NULL
             AND COALESCE(requested_date, assessment_date, request_date) IS NOT NULL
             AND first_quote_sent_date >= COALESCE(requested_date, assessment_date, request_date)
        THEN first_quote_sent_date - COALESCE(requested_date, assessment_date, request_date)
        ELSE NULL
    END
) STORED;

-- Recreate speed_to_quote_bucket with same logic
ALTER TABLE jobber_residential_opportunities
ADD COLUMN speed_to_quote_bucket TEXT GENERATED ALWAYS AS (
    CASE
        WHEN first_quote_sent_date IS NULL OR COALESCE(requested_date, assessment_date, request_date) IS NULL THEN NULL
        WHEN first_quote_sent_date < COALESCE(requested_date, assessment_date, request_date) THEN NULL
        WHEN first_quote_sent_date - COALESCE(requested_date, assessment_date, request_date) = 0 THEN 'Same day'
        WHEN first_quote_sent_date - COALESCE(requested_date, assessment_date, request_date) <= 3 THEN '1-3 days'
        WHEN first_quote_sent_date - COALESCE(requested_date, assessment_date, request_date) <= 7 THEN '4-7 days'
        ELSE '8+ days'
    END
) STORED;

-- ============================================
-- 3. CREATE INDEX
-- ============================================

CREATE INDEX IF NOT EXISTS idx_res_opp_requested_date
ON jobber_residential_opportunities(requested_date DESC);
