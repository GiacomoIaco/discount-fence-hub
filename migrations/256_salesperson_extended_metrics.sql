-- ============================================
-- MIGRATION 256: Extended Salesperson Metrics
-- ============================================
-- Adds:
--   - pct_multi_quote: % of opportunities with 2+ quotes
--   - median_days_to_decision: median days from quote to decision (won deals)

DROP FUNCTION IF EXISTS get_residential_salesperson_metrics(DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION get_residential_salesperson_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    salesperson TEXT,
    -- Request metrics
    requests_assigned BIGINT,
    pct_quoted NUMERIC,
    -- Quote count metrics
    total_opps BIGINT,
    won_opps BIGINT,
    lost_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    -- Quote value metrics
    total_value NUMERIC,
    won_value NUMERIC,
    value_win_rate NUMERIC,
    avg_won_value NUMERIC,
    -- Speed & efficiency metrics
    pct_same_day NUMERIC,
    p75_days_to_quote NUMERIC,
    avg_opp_value NUMERIC,
    pct_multi_quote NUMERIC,
    median_days_to_decision NUMERIC
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
            ROUND(AVG(o.max_quote_value)::NUMERIC, 0) AS avg_opp_val,
            -- Multi-quote percentage (2+ quotes per opportunity)
            COUNT(*) FILTER (WHERE o.quote_count >= 2)::BIGINT AS multi_quote_count,
            -- Median days to decision (for won deals)
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) AS median_dtd
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
        -- Request metrics
        COALESCE(rs.req_count, 0)::BIGINT AS requests_assigned,
        ROUND(rs.req_with_quote::NUMERIC / NULLIF(rs.req_count, 0) * 100, 1) AS pct_quoted,
        -- Quote count metrics
        COALESCE(os.opp_count, 0)::BIGINT AS total_opps,
        COALESCE(os.won_count, 0)::BIGINT AS won_opps,
        COALESCE(os.lost_count, 0)::BIGINT AS lost_opps,
        ROUND(os.won_count::NUMERIC / NULLIF(os.opp_count, 0) * 100, 1) AS win_rate,
        ROUND(os.won_count::NUMERIC / NULLIF(os.won_count + os.lost_count, 0) * 100, 1) AS closed_win_rate,
        -- Quote value metrics
        COALESCE(os.total_pipeline_value, 0)::NUMERIC AS total_value,
        COALESCE(os.total_won_value, 0)::NUMERIC AS won_value,
        ROUND(os.total_won_value / NULLIF(os.total_pipeline_value, 0) * 100, 1) AS value_win_rate,
        ROUND(os.total_won_value / NULLIF(os.won_count, 0), 0) AS avg_won_value,
        -- Speed & efficiency metrics
        ROUND(os.same_day_count::NUMERIC / NULLIF(os.opp_count, 0) * 100, 1) AS pct_same_day,
        COALESCE(os.p75_dtq, 0)::NUMERIC AS p75_days_to_quote,
        COALESCE(os.avg_opp_val, 0)::NUMERIC AS avg_opp_value,
        ROUND(os.multi_quote_count::NUMERIC / NULLIF(os.opp_count, 0) * 100, 1) AS pct_multi_quote,
        COALESCE(os.median_dtd, 0)::NUMERIC AS median_days_to_decision
    FROM opp_stats os
    FULL OUTER JOIN request_stats rs ON os.sp = rs.sp
    WHERE COALESCE(os.sp, rs.sp) IS NOT NULL
    ORDER BY COALESCE(os.total_won_value, 0) DESC;
END;
$$ LANGUAGE plpgsql;
