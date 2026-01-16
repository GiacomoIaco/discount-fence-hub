-- Migration 240: Residential Cycle Time Corrections
--
-- This migration corrects the cycle time calculations:
-- 1. Days to Quote: Assessment → First SENT (not drafted)
-- 2. Days to Decision: First Sent → Converted (client acceptance time)
-- 3. Days to Schedule: Converted → Scheduled
-- 4. Days to Close: Scheduled → Closed

-- =====================================================
-- STEP 1: Add first_sent_date column
-- =====================================================

ALTER TABLE jobber_residential_opportunities
ADD COLUMN IF NOT EXISTS first_sent_date DATE;

COMMENT ON COLUMN jobber_residential_opportunities.first_sent_date IS 'Earliest sent_date among all quotes for this opportunity';

-- =====================================================
-- STEP 2: Populate first_sent_date from quotes
-- =====================================================

UPDATE jobber_residential_opportunities o
SET first_sent_date = (
  SELECT MIN(q.sent_date)
  FROM jobber_residential_quotes q
  WHERE q.opportunity_key = o.opportunity_key
    AND q.sent_date IS NOT NULL
);

-- =====================================================
-- STEP 3: Drop old computed columns and recreate with correct formulas
-- =====================================================

-- Drop the old computed columns (they use drafted_date)
ALTER TABLE jobber_residential_opportunities
DROP COLUMN IF EXISTS days_to_quote,
DROP COLUMN IF EXISTS speed_to_quote_bucket,
DROP COLUMN IF EXISTS days_to_decision,
DROP COLUMN IF EXISTS days_to_close;

-- Recreate days_to_quote: Assessment → First SENT
ALTER TABLE jobber_residential_opportunities
ADD COLUMN days_to_quote INTEGER GENERATED ALWAYS AS (
    CASE WHEN first_sent_date IS NOT NULL AND assessment_date IS NOT NULL
              AND first_sent_date >= assessment_date
         THEN first_sent_date - assessment_date ELSE NULL END
) STORED;

-- Recreate speed_to_quote_bucket based on new days_to_quote
ALTER TABLE jobber_residential_opportunities
ADD COLUMN speed_to_quote_bucket TEXT GENERATED ALWAYS AS (
    CASE
        WHEN first_sent_date IS NULL OR assessment_date IS NULL THEN NULL
        WHEN first_sent_date < assessment_date THEN NULL
        WHEN first_sent_date - assessment_date = 0 THEN 'Same day'
        WHEN first_sent_date - assessment_date <= 3 THEN '1-3 days'
        WHEN first_sent_date - assessment_date <= 7 THEN '4-7 days'
        ELSE '8+ days'
    END
) STORED;

-- Add days_to_decision: First Sent → Converted (client acceptance time)
-- Uses won_date which is the converted_date
ALTER TABLE jobber_residential_opportunities
ADD COLUMN days_to_decision INTEGER GENERATED ALWAYS AS (
    CASE WHEN won_date IS NOT NULL AND first_sent_date IS NOT NULL
              AND won_date >= first_sent_date
         THEN won_date - first_sent_date ELSE NULL END
) STORED;

-- Add days_to_schedule: Converted → Scheduled
ALTER TABLE jobber_residential_opportunities
ADD COLUMN days_to_schedule INTEGER GENERATED ALWAYS AS (
    CASE WHEN scheduled_date IS NOT NULL AND won_date IS NOT NULL
              AND scheduled_date >= won_date
         THEN scheduled_date - won_date ELSE NULL END
) STORED;

-- Recreate days_to_close: Scheduled → Closed (not Quote → Closed)
ALTER TABLE jobber_residential_opportunities
ADD COLUMN days_to_close INTEGER GENERATED ALWAYS AS (
    CASE WHEN closed_date IS NOT NULL AND scheduled_date IS NOT NULL
              AND closed_date >= scheduled_date
         THEN closed_date - scheduled_date ELSE NULL END
) STORED;

-- =====================================================
-- STEP 4: Create index for first_sent_date
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_residential_opps_first_sent_date
ON jobber_residential_opportunities(first_sent_date);

-- =====================================================
-- STEP 5: Update RPC function for funnel metrics
-- =====================================================

CREATE OR REPLACE FUNCTION get_residential_funnel_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL,
    p_speed_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    total_opportunities BIGINT,
    won_opportunities BIGINT,
    lost_opportunities BIGINT,
    pending_opportunities BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    quoted_value NUMERIC,
    total_value NUMERIC,
    value_win_rate NUMERIC,
    avg_days_to_quote NUMERIC,
    avg_days_to_decision NUMERIC,
    avg_days_to_schedule NUMERIC,
    avg_days_to_close NUMERIC,
    same_day_quote_pct NUMERIC,
    multi_quote_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_opportunities,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT as won_opportunities,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT as lost_opportunities,
        COUNT(*) FILTER (WHERE o.is_pending)::BIGINT as pending_opportunities,
        ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1) as win_rate,
        ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100), 1) as closed_win_rate,
        COALESCE(SUM(o.won_value), 0) as won_value,
        COALESCE(SUM(o.total_quoted_value), 0) as quoted_value,
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0) as total_value,
        ROUND(
            SUM(o.won_value)::NUMERIC /
            NULLIF(SUM(
                CASE
                    WHEN o.is_won THEN o.won_value
                    ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100,
        1) as value_win_rate,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) as avg_days_to_quote,
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) as avg_days_to_decision,
        ROUND(AVG(o.days_to_schedule) FILTER (WHERE o.is_won)::NUMERIC, 1) as avg_days_to_schedule,
        ROUND(AVG(o.days_to_close) FILTER (WHERE o.is_won AND o.closed_date IS NOT NULL)::NUMERIC, 1) as avg_days_to_close,
        ROUND((COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE o.speed_to_quote_bucket IS NOT NULL), 0) * 100), 1) as same_day_quote_pct,
        ROUND((COUNT(*) FILTER (WHERE o.quote_count > 1)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1) as multi_quote_pct
    FROM jobber_residential_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket);
END;
$$;

-- =====================================================
-- STEP 6: Add function to get assessments scheduled count
-- This requires parsing requests data separately
-- =====================================================

-- Note: Assessment scheduled count would need to be tracked in opportunities
-- or aggregated from a requests table. For now, we count opportunities with assessment_date.

CREATE OR REPLACE FUNCTION get_residential_assessment_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL
)
RETURNS TABLE (
    total_assessments BIGINT,
    assessments_with_quote BIGINT,
    assessment_to_quote_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE o.assessment_date IS NOT NULL)::BIGINT as total_assessments,
        COUNT(*) FILTER (WHERE o.assessment_date IS NOT NULL AND o.first_sent_date IS NOT NULL)::BIGINT as assessments_with_quote,
        ROUND((COUNT(*) FILTER (WHERE o.assessment_date IS NOT NULL AND o.first_sent_date IS NOT NULL)::NUMERIC /
               NULLIF(COUNT(*) FILTER (WHERE o.assessment_date IS NOT NULL), 0) * 100), 1) as assessment_to_quote_rate
    FROM jobber_residential_opportunities o
    WHERE
        (p_start_date IS NULL OR o.assessment_date >= p_start_date)
        AND (p_end_date IS NULL OR o.assessment_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson);
END;
$$;

-- =====================================================
-- STEP 7: Add function to get warranty metrics
-- =====================================================

CREATE OR REPLACE FUNCTION get_residential_warranty_metrics()
RETURNS TABLE (
    total_jobs BIGINT,
    warranty_jobs BIGINT,
    warranty_pct NUMERIC,
    non_warranty_avg_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_jobs,
        COUNT(*) FILTER (WHERE j.total_revenue = 0)::BIGINT as warranty_jobs,
        ROUND((COUNT(*) FILTER (WHERE j.total_revenue = 0)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1) as warranty_pct,
        ROUND(AVG(j.total_revenue) FILTER (WHERE j.total_revenue > 0)::NUMERIC, 2) as non_warranty_avg_revenue
    FROM jobber_residential_jobs j;
END;
$$;

-- =====================================================
-- STEP 8: Update speed metrics function to use first_sent_date
-- =====================================================

CREATE OR REPLACE FUNCTION get_residential_speed_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    speed_bucket TEXT,
    bucket_order INTEGER,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    baseline_diff NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    value_win_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    baseline_rate NUMERIC;
BEGIN
    -- Calculate baseline win rate
    SELECT ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1)
    INTO baseline_rate
    FROM jobber_residential_opportunities o
    WHERE o.speed_to_quote_bucket IS NOT NULL
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket);

    RETURN QUERY
    SELECT
        o.speed_to_quote_bucket::TEXT as speed_bucket,
        CASE o.speed_to_quote_bucket
            WHEN 'Same day' THEN 1
            WHEN '1-3 days' THEN 2
            WHEN '4-7 days' THEN 3
            WHEN '8+ days' THEN 4
        END as bucket_order,
        COUNT(*)::BIGINT as total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT as won_opps,
        ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1) as win_rate,
        ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100), 1) as closed_win_rate,
        ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100) - baseline_rate, 1) as baseline_diff,
        COALESCE(SUM(o.won_value), 0) as won_value,
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0) as total_value,
        ROUND(
            SUM(o.won_value)::NUMERIC /
            NULLIF(SUM(
                CASE
                    WHEN o.is_won THEN o.won_value
                    ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100,
        1) as value_win_rate
    FROM jobber_residential_opportunities o
    WHERE o.speed_to_quote_bucket IS NOT NULL
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.speed_to_quote_bucket
    ORDER BY bucket_order;
END;
$$;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check the new columns
SELECT
    'first_sent_date populated' as check_name,
    COUNT(*) FILTER (WHERE first_sent_date IS NOT NULL) as count,
    ROUND(COUNT(*) FILTER (WHERE first_sent_date IS NOT NULL)::NUMERIC / COUNT(*) * 100, 1) as pct
FROM jobber_residential_opportunities;

-- Check new cycle time metrics
SELECT
    'Avg Days to Quote (Assessment→Sent)' as metric,
    ROUND(AVG(days_to_quote)::NUMERIC, 1) as value,
    COUNT(*) FILTER (WHERE days_to_quote IS NOT NULL) as sample_size
FROM jobber_residential_opportunities
UNION ALL
SELECT
    'Avg Days to Decision (Sent→Converted)' as metric,
    ROUND(AVG(days_to_decision)::NUMERIC, 1) as value,
    COUNT(*) FILTER (WHERE days_to_decision IS NOT NULL) as sample_size
FROM jobber_residential_opportunities
WHERE is_won = true
UNION ALL
SELECT
    'Avg Days to Schedule (Converted→Scheduled)' as metric,
    ROUND(AVG(days_to_schedule)::NUMERIC, 1) as value,
    COUNT(*) FILTER (WHERE days_to_schedule IS NOT NULL) as sample_size
FROM jobber_residential_opportunities
WHERE is_won = true
UNION ALL
SELECT
    'Avg Days to Close (Scheduled→Closed)' as metric,
    ROUND(AVG(days_to_close)::NUMERIC, 1) as value,
    COUNT(*) FILTER (WHERE days_to_close IS NOT NULL) as sample_size
FROM jobber_residential_opportunities
WHERE is_won = true AND closed_date IS NOT NULL;
