-- ============================================
-- MIGRATION 252: Fix Days to Quote Fallback
-- ============================================
-- Problem: days_to_quote is NULL when assessment_date is missing
-- Fix: Add request_date column and use COALESCE(assessment_date, request_date) as the starting point
--
-- Logic:
--   If assessment_date exists: Use assessment_date -> first_quote_sent_date
--   If no assessment_date: Use request_date -> first_quote_sent_date (fallback)

-- ============================================
-- 1. ADD REQUEST_DATE COLUMN TO OPPORTUNITIES
-- ============================================

ALTER TABLE jobber_residential_opportunities
ADD COLUMN IF NOT EXISTS request_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN jobber_residential_opportunities.request_date IS 'Fallback for days_to_quote when no assessment_date exists. Populated from requests CSV.';

-- ============================================
-- 2. DROP AND RECREATE COMPUTED COLUMNS
-- ============================================
-- PostgreSQL doesn't allow direct ALTER of generated columns

-- Drop old computed columns
ALTER TABLE jobber_residential_opportunities
DROP COLUMN IF EXISTS days_to_quote,
DROP COLUMN IF EXISTS speed_to_quote_bucket;

-- Recreate days_to_quote with COALESCE fallback
-- Uses assessment_date if available, otherwise falls back to request_date
ALTER TABLE jobber_residential_opportunities
ADD COLUMN days_to_quote INTEGER GENERATED ALWAYS AS (
    CASE
        WHEN first_quote_sent_date IS NOT NULL
             AND COALESCE(assessment_date, request_date) IS NOT NULL
             AND first_quote_sent_date >= COALESCE(assessment_date, request_date)
        THEN first_quote_sent_date - COALESCE(assessment_date, request_date)
        ELSE NULL
    END
) STORED;

-- Recreate speed_to_quote_bucket with same fallback logic
ALTER TABLE jobber_residential_opportunities
ADD COLUMN speed_to_quote_bucket TEXT GENERATED ALWAYS AS (
    CASE
        WHEN first_quote_sent_date IS NULL OR COALESCE(assessment_date, request_date) IS NULL THEN NULL
        WHEN first_quote_sent_date < COALESCE(assessment_date, request_date) THEN NULL
        WHEN first_quote_sent_date - COALESCE(assessment_date, request_date) = 0 THEN 'Same day'
        WHEN first_quote_sent_date - COALESCE(assessment_date, request_date) <= 3 THEN '1-3 days'
        WHEN first_quote_sent_date - COALESCE(assessment_date, request_date) <= 7 THEN '4-7 days'
        ELSE '8+ days'
    END
) STORED;

-- ============================================
-- 3. SIMPLE BACKFILL: Use first_quote_date as request_date fallback
-- ============================================
-- For opportunities that don't have assessment_date, use first_quote_date
-- This gives a baseline (0 days to quote) which is better than NULL

UPDATE jobber_residential_opportunities
SET request_date = first_quote_date
WHERE request_date IS NULL
  AND assessment_date IS NULL
  AND first_quote_date IS NOT NULL;

-- ============================================
-- 4. CREATE INDEX FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_res_opp_request_date
ON jobber_residential_opportunities(request_date DESC);
