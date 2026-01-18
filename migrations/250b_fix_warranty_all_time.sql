-- ============================================
-- MIGRATION 250: Fix Warranty Metrics for "All Time"
-- ============================================
-- Problem: When p_start_date is NULL (All Time), the function defaults to
--          30 days ago instead of looking at all records.
-- Fix: Use '1900-01-01' as default start date to include all historical data

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
    -- FIX: Use earliest possible date for "All Time" instead of 30 days
    v_period_start := COALESCE(p_start_date, '1900-01-01'::DATE);
    v_baseline_start := v_period_end - (p_baseline_weeks || ' weeks')::INTERVAL;
    -- Calculate weeks in period (minimum 1 week)
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
-- VERIFICATION
-- ============================================
/*
-- Test All Time (should show all jobs, not just last 30 days)
SELECT * FROM get_residential_warranty_metrics(NULL, NULL, 8);

-- Compare with direct count
SELECT
    COUNT(*) FILTER (WHERE is_warranty = TRUE) AS warranty_count,
    COUNT(*) FILTER (WHERE is_warranty = FALSE) AS paid_count
FROM jobber_residential_jobs
WHERE closed_date IS NOT NULL;
*/
