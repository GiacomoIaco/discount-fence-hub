-- ============================================
-- MIGRATION 255: Salesperson Funnel Metrics + P75 Days to Quote
-- ============================================
-- Changes:
-- 1. Replace AVG(days_to_quote) with P75 (75th percentile)
-- 2. Add new columns:
--    - requests_assigned: COUNT of requests assigned to salesperson
--    - pct_quoted: % of requests that received at least 1 quote
--    - pct_same_day: % of opportunities quoted same day
--    - avg_opp_value: Average opportunity value (1 opp = 1 weight)

DROP FUNCTION IF EXISTS get_residential_salesperson_metrics(DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION get_residential_salesperson_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    salesperson TEXT,
    -- Existing metrics
    total_opps BIGINT,
    won_opps BIGINT,
    lost_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    value_win_rate NUMERIC,
    avg_won_value NUMERIC,
    -- Changed: P75 instead of AVG
    p75_days_to_quote NUMERIC,
    -- NEW: Funnel metrics
    requests_assigned BIGINT,
    pct_quoted NUMERIC,
    pct_same_day NUMERIC,
    avg_opp_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH request_stats AS (
        -- Count requests assigned to each salesperson
        SELECT
            r.assessment_assigned_to AS sp,
            COUNT(*)::BIGINT AS req_count,
            COUNT(*) FILTER (WHERE r.quote_numbers IS NOT NULL AND r.quote_numbers != '')::BIGINT AS req_with_quote
        FROM jobber_residential_requests r
        WHERE
            r.assessment_assigned_to IS NOT NULL
            AND r.assessment_assigned_to != ''
            AND (p_start_date IS NULL OR r.assessment_date >= p_start_date OR r.requested_date >= p_start_date)
            AND (p_end_date IS NULL OR r.assessment_date <= p_end_date OR r.requested_date <= p_end_date)
        GROUP BY r.assessment_assigned_to
    ),
    opp_stats AS (
        -- Opportunity metrics per salesperson
        SELECT
            o.salesperson AS sp,
            COUNT(*)::BIGINT AS opp_count,
            COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_count,
            COUNT(*) FILTER (WHERE o.is_lost)::BIGINT AS lost_count,
            COALESCE(SUM(o.won_value), 0)::NUMERIC AS total_won_value,
            COALESCE(SUM(
                CASE WHEN o.is_won THEN o.won_value
                     ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0)::NUMERIC AS total_pipeline_value,
            -- P75 days to quote
            ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.days_to_quote)::NUMERIC, 1) AS p75_dtq,
            -- Same-day percentage
            COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::BIGINT AS same_day_count,
            -- Average opportunity value (max_quote_value per opp)
            ROUND(AVG(o.max_quote_value)::NUMERIC, 0) AS avg_opp_val
        FROM jobber_residential_opportunities o
        WHERE
            o.salesperson IS NOT NULL AND o.salesperson != ''
            AND (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
            AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
            AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        GROUP BY o.salesperson
    )
    SELECT
        COALESCE(os.sp, rs.sp) AS salesperson,
        -- Existing metrics
        COALESCE(os.opp_count, 0)::BIGINT AS total_opps,
        COALESCE(os.won_count, 0)::BIGINT AS won_opps,
        COALESCE(os.lost_count, 0)::BIGINT AS lost_opps,
        ROUND(os.won_count::NUMERIC / NULLIF(os.opp_count, 0) * 100, 1) AS win_rate,
        ROUND(os.won_count::NUMERIC / NULLIF(os.won_count + os.lost_count, 0) * 100, 1) AS closed_win_rate,
        COALESCE(os.total_won_value, 0)::NUMERIC AS won_value,
        COALESCE(os.total_pipeline_value, 0)::NUMERIC AS total_value,
        ROUND(os.total_won_value / NULLIF(os.total_pipeline_value, 0) * 100, 1) AS value_win_rate,
        ROUND(os.total_won_value / NULLIF(os.won_count, 0), 0) AS avg_won_value,
        -- P75 days to quote (replaces avg)
        COALESCE(os.p75_dtq, 0)::NUMERIC AS p75_days_to_quote,
        -- NEW: Funnel metrics
        COALESCE(rs.req_count, 0)::BIGINT AS requests_assigned,
        ROUND(rs.req_with_quote::NUMERIC / NULLIF(rs.req_count, 0) * 100, 1) AS pct_quoted,
        ROUND(os.same_day_count::NUMERIC / NULLIF(os.opp_count, 0) * 100, 1) AS pct_same_day,
        COALESCE(os.avg_opp_val, 0)::NUMERIC AS avg_opp_value
    FROM opp_stats os
    FULL OUTER JOIN request_stats rs ON os.sp = rs.sp
    WHERE COALESCE(os.sp, rs.sp) IS NOT NULL
    ORDER BY COALESCE(os.total_won_value, 0) DESC;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Also update funnel metrics to use P75
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
    -- Changed to P75
    p75_days_to_quote NUMERIC,
    avg_days_to_decision NUMERIC,
    avg_days_to_schedule NUMERIC,
    avg_days_to_close NUMERIC,
    total_cycle_days NUMERIC,
    -- Same-day percentage
    pct_same_day NUMERIC
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
        COALESCE(SUM(o.max_quote_value), 0)::NUMERIC,
        COALESCE(SUM(o.max_quote_value), 0)::NUMERIC,
        ROUND(COALESCE(SUM(o.won_value), 0) / NULLIF(SUM(o.max_quote_value), 0) * 100, 1),
        -- P75 days to quote
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.days_to_quote)::NUMERIC, 1),
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1),
        ROUND(AVG(o.days_to_schedule) FILTER (WHERE o.is_won AND o.days_to_schedule IS NOT NULL)::NUMERIC, 1),
        ROUND(AVG(o.days_to_close) FILTER (WHERE o.is_won AND o.days_to_close IS NOT NULL)::NUMERIC, 1),
        ROUND(AVG(
            CASE
                WHEN o.is_won AND o.closed_date IS NOT NULL AND o.assessment_date IS NOT NULL
                THEN o.closed_date - o.assessment_date
                ELSE NULL
            END
        )::NUMERIC, 1),
        -- Same-day percentage
        ROUND(COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1)
    FROM jobber_residential_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket);
END;
$$ LANGUAGE plpgsql;
