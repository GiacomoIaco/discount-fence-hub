-- ============================================
-- MIGRATION 248: Fix Warranty RPC & Add Trend Functions
-- ============================================
-- Fixes:
--   1. WARRANTY RPC: EXTRACT(DAY FROM integer) error - date subtraction returns integer, not interval
--   2. Add monthly trend functions for all key metrics

-- ============================================
-- 1. FIX WARRANTY METRICS FUNCTION
-- ============================================

DROP FUNCTION IF EXISTS get_residential_warranty_metrics(DATE, DATE, INTEGER);

CREATE OR REPLACE FUNCTION get_residential_warranty_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_baseline_weeks INTEGER DEFAULT 8
)
RETURNS TABLE (
    warranty_count BIGINT,
    paid_count BIGINT,
    warranty_percent NUMERIC,
    baseline_weekly_avg NUMERIC
) AS $$
DECLARE
    v_baseline_start DATE;
    v_period_start DATE;
    v_period_end DATE;
    v_period_weeks NUMERIC;
BEGIN
    -- Set period dates
    v_period_end := COALESCE(p_end_date, CURRENT_DATE);
    v_period_start := COALESCE(p_start_date, v_period_end - INTERVAL '30 days');
    v_baseline_start := v_period_end - (p_baseline_weeks || ' weeks')::INTERVAL;
    -- FIX: Date subtraction returns integer (days), not interval. Cast to numeric directly.
    v_period_weeks := GREATEST(1, (v_period_end - v_period_start)::NUMERIC / 7.0);

    RETURN QUERY
    WITH warranty_in_period AS (
        SELECT COUNT(*)::BIGINT AS cnt
        FROM jobber_residential_jobs
        WHERE is_warranty = TRUE
            AND closed_date >= v_period_start
            AND closed_date <= v_period_end
    ),
    paid_in_period AS (
        SELECT COUNT(*)::BIGINT AS cnt
        FROM jobber_residential_jobs
        WHERE is_warranty = FALSE
            AND closed_date >= v_period_start
            AND closed_date <= v_period_end
    ),
    baseline_paid AS (
        SELECT COUNT(*)::BIGINT AS cnt
        FROM jobber_residential_jobs
        WHERE is_warranty = FALSE
            AND closed_date >= v_baseline_start
            AND closed_date <= v_period_end
    )
    SELECT
        w.cnt AS warranty_count,
        p.cnt AS paid_count,
        ROUND(w.cnt::NUMERIC / NULLIF((b.cnt::NUMERIC / p_baseline_weeks * v_period_weeks), 0) * 100, 1) AS warranty_percent,
        ROUND(b.cnt::NUMERIC / p_baseline_weeks, 1) AS baseline_weekly_avg
    FROM warranty_in_period w, paid_in_period p, baseline_paid b;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. ADD MONTHLY CYCLE TIME TRENDS FUNCTION
-- ============================================

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
            ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days_to_quote,
            ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_decision,
            ROUND(AVG(o.days_to_schedule) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_schedule,
            ROUND(AVG(o.days_to_close) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_close,
            ROUND(AVG(
                CASE WHEN o.is_won AND o.closed_date IS NOT NULL AND o.assessment_date IS NOT NULL
                     THEN o.closed_date - o.assessment_date
                     ELSE NULL END
            )::NUMERIC, 1) AS total_cycle_days,
            COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::BIGINT AS same_day_count,
            ROUND(COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::NUMERIC /
                  NULLIF(COUNT(*), 0) * 100, 1) AS same_day_percent,
            COUNT(*) FILTER (WHERE o.quote_count > 1)::BIGINT AS multi_quote_count,
            ROUND(COUNT(*) FILTER (WHERE o.quote_count > 1)::NUMERIC /
                  NULLIF(COUNT(*), 0) * 100, 1) AS multi_quote_percent,
            ROUND(AVG(o.won_value) FILTER (WHERE o.is_won)::NUMERIC, 0) AS avg_won_deal
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
        COALESCE(o.avg_days_to_quote, 0),
        COALESCE(o.avg_days_to_decision, 0),
        COALESCE(o.avg_days_to_schedule, 0),
        COALESCE(o.avg_days_to_close, 0),
        COALESCE(o.total_cycle_days, 0),
        COALESCE(o.same_day_count, 0),
        COALESCE(o.same_day_percent, 0),
        COALESCE(o.multi_quote_count, 0),
        COALESCE(o.multi_quote_percent, 0),
        COALESCE(o.avg_won_deal, 0),
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
-- Test warranty metrics
SELECT * FROM get_residential_warranty_metrics(NULL, NULL, 8);

-- Test cycle trends
SELECT * FROM get_residential_monthly_cycle_trends(13);
*/
