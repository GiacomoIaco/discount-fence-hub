-- ============================================================================
-- Migration 270: Fix API Residential Metrics Formulas
-- Addresses multiple calculation issues identified by user:
-- 1. Win Rate % should be won/total (not won/(won+lost))
-- 2. % Multi-Quote showing 100% (bucket name mismatch with frontend)
-- 3. Total Opportunity Value missing from funnel metrics
-- 4. Day to... metrics (schedule, close, total cycle) often NULL
-- ============================================================================

-- ============================================
-- 1. FIX FUNNEL METRICS
-- - Change win_rate to won/total
-- - Add total_value (normalized)
-- - Add value_win_rate
-- ============================================

DROP FUNCTION IF EXISTS get_api_residential_funnel_metrics(DATE, DATE, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_api_residential_funnel_metrics(
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
    total_value NUMERIC,
    won_value NUMERIC,
    value_win_rate NUMERIC,
    avg_quote_value NUMERIC,
    avg_days_to_quote NUMERIC,
    avg_days_to_decision NUMERIC,
    avg_days_to_schedule NUMERIC,
    avg_days_to_close NUMERIC,
    total_cycle_days NUMERIC,
    same_day_quote_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_opportunities,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opportunities,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT AS lost_opportunities,
        COUNT(*) FILTER (WHERE o.is_pending)::BIGINT AS pending_opportunities,
        -- Win Rate = won/total (what user wants - many lost opps aren't recorded)
        ROUND(
            CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*)
            END, 1
        ) AS win_rate,
        -- Closed Win Rate = won/(won+lost) for comparison
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.is_won OR o.is_lost) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*) FILTER (WHERE o.is_won OR o.is_lost)
            END, 1
        ) AS closed_win_rate,
        -- Total Value = normalized (won_value if won, else avg quote value)
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0) AS total_value,
        COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) AS won_value,
        -- Value Win Rate
        ROUND(
            CASE
                WHEN SUM(CASE WHEN o.is_won THEN o.won_value ELSE o.total_quoted_value / NULLIF(o.quote_count, 0) END) = 0 THEN 0
                ELSE 100.0 * COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) /
                     SUM(CASE WHEN o.is_won THEN o.won_value ELSE o.total_quoted_value / NULLIF(o.quote_count, 0) END)
            END, 1
        ) AS value_win_rate,
        ROUND(AVG(o.max_quote_value)::NUMERIC, 0) AS avg_quote_value,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days_to_quote,
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_decision,
        ROUND(AVG(o.days_to_schedule) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_schedule,
        ROUND(AVG(o.days_to_close) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_close,
        ROUND(AVG(o.total_cycle_days) FILTER (WHERE o.is_won)::NUMERIC, 1) AS total_cycle_days,
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.days_to_quote IS NOT NULL) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day') / COUNT(*) FILTER (WHERE o.days_to_quote IS NOT NULL)
            END, 1
        ) AS same_day_quote_pct
    FROM jobber_api_opportunities o
    WHERE (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket);
END;
$fn$;


-- ============================================
-- 2. FIX QUOTE COUNT METRICS
-- Return bucket names that match frontend expectations:
-- '1 quote', '2 quotes', '3 quotes', '4+ quotes'
-- Also add total_value and value_win_rate
-- ============================================

DROP FUNCTION IF EXISTS get_api_residential_quote_count_metrics(DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION get_api_residential_quote_count_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    quote_count_bucket TEXT,
    bucket_order INTEGER,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    total_value NUMERIC,
    won_value NUMERIC,
    value_win_rate NUMERIC,
    avg_days_to_decision NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        -- Match frontend expected bucket names
        CASE
            WHEN o.quote_count = 1 THEN '1 quote'
            WHEN o.quote_count = 2 THEN '2 quotes'
            WHEN o.quote_count = 3 THEN '3 quotes'
            WHEN o.quote_count >= 4 THEN '4+ quotes'
            ELSE '1 quote'
        END AS quote_count_bucket,
        CASE
            WHEN o.quote_count = 1 THEN 1
            WHEN o.quote_count = 2 THEN 2
            WHEN o.quote_count = 3 THEN 3
            WHEN o.quote_count >= 4 THEN 4
            ELSE 1
        END AS bucket_order,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        -- Win rate = won/total
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        -- Closed win rate = won/(won+lost)
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1) AS closed_win_rate,
        -- Total value (normalized)
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC AS total_value,
        COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0)::NUMERIC AS won_value,
        -- Value win rate
        ROUND(
            COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) /
            NULLIF(SUM(
                CASE WHEN o.is_won THEN o.won_value
                     ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100
        , 1) AS value_win_rate,
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_decision
    FROM jobber_api_opportunities o
    WHERE (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY
        CASE
            WHEN o.quote_count = 1 THEN '1 quote'
            WHEN o.quote_count = 2 THEN '2 quotes'
            WHEN o.quote_count = 3 THEN '3 quotes'
            WHEN o.quote_count >= 4 THEN '4+ quotes'
            ELSE '1 quote'
        END,
        CASE
            WHEN o.quote_count = 1 THEN 1
            WHEN o.quote_count = 2 THEN 2
            WHEN o.quote_count = 3 THEN 3
            WHEN o.quote_count >= 4 THEN 4
            ELSE 1
        END
    ORDER BY bucket_order;
END;
$fn$;


-- ============================================
-- 3. FIX REQUEST METRICS
-- Query the jobber_api_requests table properly
-- ============================================

DROP FUNCTION IF EXISTS get_api_residential_request_metrics(DATE, DATE);

CREATE OR REPLACE FUNCTION get_api_residential_request_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_requests BIGINT,
    assessments_scheduled BIGINT,
    assessments_completed BIGINT,
    converted_to_quote BIGINT,
    conversion_rate NUMERIC,
    avg_days_to_assessment NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_requests,
        COUNT(*) FILTER (WHERE r.assessment_date IS NOT NULL)::BIGINT AS assessments_scheduled,
        COUNT(*) FILTER (WHERE r.assessment_completed = TRUE)::BIGINT AS assessments_completed,
        COUNT(*) FILTER (WHERE r.converted_to_quote = TRUE)::BIGINT AS converted_to_quote,
        ROUND(
            CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE r.converted_to_quote = TRUE) / COUNT(*)
            END, 1
        ) AS conversion_rate,
        ROUND(AVG(
            EXTRACT(DAY FROM (r.assessment_date - r.created_date))
        ) FILTER (WHERE r.assessment_date IS NOT NULL)::NUMERIC, 1) AS avg_days_to_assessment
    FROM jobber_api_requests r
    WHERE (p_start_date IS NULL OR r.created_date >= p_start_date)
        AND (p_end_date IS NULL OR r.created_date <= p_end_date);
END;
$fn$;


-- ============================================
-- 4. UPDATE SALESPERSON METRICS
-- Use won/total for win rate
-- ============================================

DROP FUNCTION IF EXISTS get_api_residential_salesperson_metrics(DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION get_api_residential_salesperson_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    salesperson TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    pending_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    avg_days_to_quote NUMERIC,
    same_day_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(o.salesperson, 'Unknown') AS salesperson,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        COUNT(*) FILTER (WHERE o.is_pending)::BIGINT AS pending_opps,
        -- Win rate = won/total
        ROUND(
            CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*)
            END, 1
        ) AS win_rate,
        -- Closed win rate for reference
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.is_won OR o.is_lost) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*) FILTER (WHERE o.is_won OR o.is_lost)
            END, 1
        ) AS closed_win_rate,
        COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) AS won_value,
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0) AS total_value,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days_to_quote,
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.days_to_quote IS NOT NULL) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day') / COUNT(*) FILTER (WHERE o.days_to_quote IS NOT NULL)
            END, 1
        ) AS same_day_pct
    FROM jobber_api_opportunities o
    WHERE (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.salesperson
    ORDER BY won_value DESC;
END;
$fn$;


-- ============================================
-- 5. UPDATE SPEED METRICS
-- Use won/total for win rate
-- ============================================

DROP FUNCTION IF EXISTS get_api_residential_speed_metrics(DATE, DATE, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_api_residential_speed_metrics(
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
    won_value NUMERIC,
    avg_days_to_quote NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        o.speed_to_quote_bucket AS speed_bucket,
        CASE o.speed_to_quote_bucket
            WHEN 'Same day' THEN 1
            WHEN '1-3 days' THEN 2
            WHEN '4-7 days' THEN 3
            WHEN '8+ days' THEN 4
            ELSE 5
        END AS bucket_order,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        -- Win rate = won/total
        ROUND(
            CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*)
            END, 1
        ) AS win_rate,
        -- Closed win rate
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.is_won OR o.is_lost) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*) FILTER (WHERE o.is_won OR o.is_lost)
            END, 1
        ) AS closed_win_rate,
        COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) AS won_value,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days_to_quote
    FROM jobber_api_opportunities o
    WHERE (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND o.speed_to_quote_bucket IS NOT NULL
    GROUP BY o.speed_to_quote_bucket
    ORDER BY bucket_order;
END;
$fn$;


-- ============================================
-- 6. UPDATE BUCKET (PROJECT SIZE) METRICS
-- Use won/total for win rate
-- ============================================

DROP FUNCTION IF EXISTS get_api_residential_bucket_metrics(DATE, DATE, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_api_residential_bucket_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL,
    p_speed_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    bucket TEXT,
    bucket_order INTEGER,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    avg_days_to_quote NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        o.revenue_bucket AS bucket,
        CASE o.revenue_bucket
            WHEN 'Under $1K' THEN 1
            WHEN '$1K-$3K' THEN 2
            WHEN '$3K-$5K' THEN 3
            WHEN '$5K-$10K' THEN 4
            WHEN '$10K-$25K' THEN 5
            WHEN '$25K+' THEN 6
            ELSE 7
        END AS bucket_order,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        -- Win rate = won/total
        ROUND(
            CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*)
            END, 1
        ) AS win_rate,
        -- Closed win rate
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.is_won OR o.is_lost) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*) FILTER (WHERE o.is_won OR o.is_lost)
            END, 1
        ) AS closed_win_rate,
        COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) AS won_value,
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0) AS total_value,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days_to_quote
    FROM jobber_api_opportunities o
    WHERE (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket)
        AND o.revenue_bucket IS NOT NULL
    GROUP BY o.revenue_bucket
    ORDER BY bucket_order;
END;
$fn$;


-- Grant permissions
GRANT EXECUTE ON FUNCTION get_api_residential_funnel_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_api_residential_quote_count_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_api_residential_request_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_api_residential_salesperson_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_api_residential_speed_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_api_residential_bucket_metrics TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 270 completed: Fixed API metrics formulas';
    RAISE NOTICE '  - Win rate now uses won/total (not won/(won+lost))';
    RAISE NOTICE '  - Added total_value and value_win_rate to funnel metrics';
    RAISE NOTICE '  - Fixed quote_count_bucket names to match frontend';
    RAISE NOTICE '  - Fixed request metrics function';
END $$;
