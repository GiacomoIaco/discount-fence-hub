-- ============================================
-- MIGRATION 249: Use Median for Cycle Time Metrics
-- ============================================
-- Problem: Average is skewed by outliers (e.g., one quote that took 60 days)
-- Fix: Use MEDIAN (percentile_cont(0.5)) instead of AVG for all cycle time metrics
--
-- This affects:
--   - days_to_quote
--   - days_to_decision
--   - days_to_schedule
--   - days_to_close
--   - total_cycle_days
--   - avg_won_deal (renamed to median_won_deal conceptually)

-- ============================================
-- 1. UPDATE FUNNEL METRICS FUNCTION
-- ============================================

DROP FUNCTION IF EXISTS get_residential_funnel_metrics(DATE, DATE, TEXT, TEXT, TEXT);

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
    total_cycle_days NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_pending)::BIGINT,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1),
        COALESCE(SUM(o.won_value), 0)::NUMERIC,
        COALESCE(SUM(o.avg_quote_value), 0)::NUMERIC,
        COALESCE(SUM(
            CASE WHEN o.is_won THEN o.won_value ELSE COALESCE(o.avg_quote_value, 0) END
        ), 0)::NUMERIC,
        ROUND(
            COALESCE(SUM(o.won_value), 0) /
            NULLIF(SUM(CASE WHEN o.is_won THEN o.won_value ELSE COALESCE(o.avg_quote_value, 0) END), 0) * 100,
        1),
        -- MEDIAN instead of AVG for cycle times (more robust to outliers)
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_quote)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_schedule) FILTER (WHERE o.is_won AND o.days_to_schedule IS NOT NULL)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_close) FILTER (WHERE o.is_won AND o.days_to_close IS NOT NULL)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
            CASE WHEN o.is_won AND o.closed_date IS NOT NULL AND o.assessment_date IS NOT NULL
                 THEN o.closed_date - o.assessment_date ELSE NULL END
        )::NUMERIC, 1)
    FROM jobber_residential_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. UPDATE MONTHLY CYCLE TRENDS FUNCTION
-- ============================================

DROP FUNCTION IF EXISTS get_residential_monthly_cycle_trends(INTEGER);

CREATE OR REPLACE FUNCTION get_residential_monthly_cycle_trends(
    p_months INTEGER DEFAULT 13
)
RETURNS TABLE (
    month TEXT,
    month_label TEXT,
    avg_days_to_quote NUMERIC,
    avg_days_to_decision NUMERIC,
    avg_days_to_schedule NUMERIC,
    avg_days_to_close NUMERIC,
    total_cycle_days NUMERIC,
    same_day_count BIGINT,
    same_day_percent NUMERIC,
    multi_quote_count BIGINT,
    multi_quote_percent NUMERIC,
    avg_won_deal NUMERIC,
    request_count BIGINT,
    assessment_count BIGINT,
    warranty_count BIGINT,
    paid_job_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH months AS (
        SELECT
            TO_CHAR(d, 'YYYY-MM') AS month,
            TO_CHAR(d, 'Mon YYYY') AS month_label,
            d::DATE AS month_start,
            (d + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS month_end
        FROM generate_series(
            DATE_TRUNC('month', CURRENT_DATE) - ((p_months - 1) || ' months')::INTERVAL,
            DATE_TRUNC('month', CURRENT_DATE),
            '1 month'::INTERVAL
        ) AS d
    ),
    opp_metrics AS (
        SELECT
            TO_CHAR(o.first_quote_date, 'YYYY-MM') AS month,
            -- Use MEDIAN (percentile_cont 0.5) for cycle times
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_quote)::NUMERIC, 1) AS median_days_to_quote,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) AS median_days_to_decision,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_schedule) FILTER (WHERE o.is_won)::NUMERIC, 1) AS median_days_to_schedule,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_close) FILTER (WHERE o.is_won)::NUMERIC, 1) AS median_days_to_close,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
                CASE WHEN o.is_won AND o.closed_date IS NOT NULL AND o.assessment_date IS NOT NULL
                     THEN o.closed_date - o.assessment_date ELSE NULL END
            )::NUMERIC, 1) AS median_total_cycle,
            COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::BIGINT AS same_day_count,
            ROUND(COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::NUMERIC /
                  NULLIF(COUNT(*), 0) * 100, 1) AS same_day_percent,
            COUNT(*) FILTER (WHERE o.quote_count > 1)::BIGINT AS multi_quote_count,
            ROUND(COUNT(*) FILTER (WHERE o.quote_count > 1)::NUMERIC /
                  NULLIF(COUNT(*), 0) * 100, 1) AS multi_quote_percent,
            -- Use MEDIAN for won deal size too
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.won_value) FILTER (WHERE o.is_won)::NUMERIC, 0) AS median_won_deal
        FROM jobber_residential_opportunities o
        WHERE o.first_quote_date IS NOT NULL
        GROUP BY TO_CHAR(o.first_quote_date, 'YYYY-MM')
    ),
    request_metrics AS (
        SELECT
            TO_CHAR(r.assessment_date, 'YYYY-MM') AS month,
            COUNT(*)::BIGINT AS request_count,
            COUNT(*) FILTER (WHERE r.assessment_date IS NOT NULL)::BIGINT AS assessment_count
        FROM jobber_residential_requests r
        WHERE r.requested_date IS NOT NULL OR r.assessment_date IS NOT NULL
        GROUP BY TO_CHAR(r.assessment_date, 'YYYY-MM')
    ),
    job_metrics AS (
        SELECT
            TO_CHAR(j.closed_date, 'YYYY-MM') AS month,
            COUNT(*) FILTER (WHERE j.is_warranty = TRUE)::BIGINT AS warranty_count,
            COUNT(*) FILTER (WHERE j.is_warranty = FALSE)::BIGINT AS paid_job_count
        FROM jobber_residential_jobs j
        WHERE j.closed_date IS NOT NULL
        GROUP BY TO_CHAR(j.closed_date, 'YYYY-MM')
    )
    SELECT
        m.month,
        m.month_label,
        COALESCE(o.median_days_to_quote, 0),
        COALESCE(o.median_days_to_decision, 0),
        COALESCE(o.median_days_to_schedule, 0),
        COALESCE(o.median_days_to_close, 0),
        COALESCE(o.median_total_cycle, 0),
        COALESCE(o.same_day_count, 0),
        COALESCE(o.same_day_percent, 0),
        COALESCE(o.multi_quote_count, 0),
        COALESCE(o.multi_quote_percent, 0),
        COALESCE(o.median_won_deal, 0),
        COALESCE(r.request_count, 0),
        COALESCE(r.assessment_count, 0),
        COALESCE(j.warranty_count, 0),
        COALESCE(j.paid_job_count, 0)
    FROM months m
    LEFT JOIN opp_metrics o ON o.month = m.month
    LEFT JOIN request_metrics r ON r.month = m.month
    LEFT JOIN job_metrics j ON j.month = m.month
    ORDER BY m.month;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION
-- ============================================
/*
-- Compare median vs average for days_to_quote
SELECT
    'Average' AS metric_type,
    ROUND(AVG(days_to_quote)::NUMERIC, 1) AS days_to_quote,
    ROUND(AVG(days_to_decision)::NUMERIC, 1) AS days_to_decision,
    ROUND(AVG(days_to_close)::NUMERIC, 1) AS days_to_close
FROM jobber_residential_opportunities
WHERE days_to_quote IS NOT NULL
UNION ALL
SELECT
    'Median' AS metric_type,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_quote)::NUMERIC, 1),
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_decision)::NUMERIC, 1),
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_close)::NUMERIC, 1)
FROM jobber_residential_opportunities
WHERE days_to_quote IS NOT NULL;

-- Check for outliers in days_to_quote
SELECT days_to_quote, COUNT(*)
FROM jobber_residential_opportunities
WHERE days_to_quote IS NOT NULL
GROUP BY days_to_quote
ORDER BY days_to_quote DESC
LIMIT 20;
*/
