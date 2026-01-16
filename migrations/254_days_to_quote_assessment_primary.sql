-- ============================================
-- MIGRATION 254: Days to Quote - Assessment Date Primary
-- ============================================
-- Correct logic:
--   PRIMARY: assessment_date → first_quote_sent_date (when we visited customer)
--   FALLBACK: requested_date (for ~10% warranties/repairs without assessment)
--
-- Same-day (0 days) is VALID - means assessment and quote sent same day (efficient!)

-- Drop and recreate computed columns
ALTER TABLE jobber_residential_opportunities
DROP COLUMN IF EXISTS days_to_quote,
DROP COLUMN IF EXISTS speed_to_quote_bucket;

-- Recreate days_to_quote: assessment_date PRIMARY, requested_date fallback
ALTER TABLE jobber_residential_opportunities
ADD COLUMN days_to_quote INTEGER GENERATED ALWAYS AS (
    CASE
        WHEN first_quote_sent_date IS NOT NULL
             AND COALESCE(assessment_date, requested_date) IS NOT NULL
             AND first_quote_sent_date >= COALESCE(assessment_date, requested_date)
        THEN first_quote_sent_date - COALESCE(assessment_date, requested_date)
        ELSE NULL
    END
) STORED;

-- Recreate speed_to_quote_bucket
ALTER TABLE jobber_residential_opportunities
ADD COLUMN speed_to_quote_bucket TEXT GENERATED ALWAYS AS (
    CASE
        WHEN first_quote_sent_date IS NULL OR COALESCE(assessment_date, requested_date) IS NULL THEN NULL
        WHEN first_quote_sent_date < COALESCE(assessment_date, requested_date) THEN NULL
        WHEN first_quote_sent_date - COALESCE(assessment_date, requested_date) = 0 THEN 'Same day'
        WHEN first_quote_sent_date - COALESCE(assessment_date, requested_date) <= 3 THEN '1-3 days'
        WHEN first_quote_sent_date - COALESCE(assessment_date, requested_date) <= 7 THEN '4-7 days'
        ELSE '8+ days'
    END
) STORED;
