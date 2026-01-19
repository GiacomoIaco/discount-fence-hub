-- ============================================
-- Migration 267: Additional API Metrics Functions
-- ============================================
-- Creates parity with CSV dashboard functions:
-- - Warranty metrics
-- - Request metrics
-- - Monthly cycle trends (for operational trends chart)
-- - Enhanced monthly totals
-- ============================================

-- ============================================
-- 1. WARRANTY METRICS (from API jobs)
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_warranty_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    paid_count BIGINT,
    warranty_count BIGINT,
    warranty_percent NUMERIC,
    paid_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE j.total > 0)::BIGINT AS paid_count,
        COUNT(*) FILTER (WHERE j.total = 0)::BIGINT AS warranty_count,
        ROUND(
            COUNT(*) FILTER (WHERE j.total = 0)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE j.total > 0), 0) * 100
        , 1) AS warranty_percent,
        COALESCE(SUM(j.total) FILTER (WHERE j.total > 0), 0)::NUMERIC AS paid_revenue
    FROM jobber_api_jobs j
    WHERE
        (p_start_date IS NULL OR j.created_at_jobber::DATE >= p_start_date)
        AND (p_end_date IS NULL OR j.created_at_jobber::DATE <= p_end_date);
END;
$$;

-- ============================================
-- 2. REQUEST METRICS (from API requests)
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_request_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_requests BIGINT,
    assessments_scheduled BIGINT,
    assessments_completed BIGINT,
    conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_requests,
        COUNT(*) FILTER (WHERE r.assessment_start_at IS NOT NULL)::BIGINT AS assessments_scheduled,
        COUNT(*) FILTER (WHERE r.assessment_completed_at IS NOT NULL)::BIGINT AS assessments_completed,
        ROUND(
            COUNT(*) FILTER (WHERE r.assessment_start_at IS NOT NULL)::NUMERIC /
            NULLIF(COUNT(*), 0) * 100
        , 1) AS conversion_rate
    FROM jobber_api_requests r
    WHERE
        (p_start_date IS NULL OR r.created_at::DATE >= p_start_date)
        AND (p_end_date IS NULL OR r.created_at::DATE <= p_end_date);
END;
$$;

-- ============================================
-- 3. MONTHLY CYCLE TRENDS (for operational trends chart)
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_monthly_cycle_trends(
    p_months INTEGER DEFAULT 13
)
RETURNS TABLE (
    month TEXT,
    month_label TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    same_day_count BIGINT,
    same_day_percent NUMERIC,
    multi_quote_count BIGINT,
    multi_quote_percent NUMERIC,
    avg_won_deal NUMERIC,
    avg_days_to_quote NUMERIC,
    avg_days_to_decision NUMERIC,
    avg_days_to_schedule NUMERIC,
    avg_days_to_close NUMERIC,
    warranty_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(o.first_sent_date, 'YYYY-MM') AS month,
        TO_CHAR(o.first_sent_date, 'Mon YYYY') AS month_label,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::BIGINT AS same_day_count,
        ROUND(
            COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE o.speed_to_quote_bucket IS NOT NULL), 0) * 100
        , 1) AS same_day_percent,
        COUNT(*) FILTER (WHERE o.quote_count > 1)::BIGINT AS multi_quote_count,
        ROUND(
            COUNT(*) FILTER (WHERE o.quote_count > 1)::NUMERIC /
            NULLIF(COUNT(*), 0) * 100
        , 1) AS multi_quote_percent,
        ROUND(
            COALESCE(SUM(o.won_value), 0) / NULLIF(COUNT(*) FILTER (WHERE o.is_won), 0)
        , 0) AS avg_won_deal,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days_to_quote,
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_decision,
        ROUND(AVG(o.days_to_schedule) FILTER (WHERE o.is_won AND o.days_to_schedule IS NOT NULL)::NUMERIC, 1) AS avg_days_to_schedule,
        ROUND(AVG(o.days_to_close) FILTER (WHERE o.is_won AND o.days_to_close IS NOT NULL)::NUMERIC, 1) AS avg_days_to_close,
        0::BIGINT AS warranty_count  -- Placeholder - would need job linkage for warranties
    FROM jobber_api_opportunities o
    WHERE
        o.first_sent_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
    GROUP BY TO_CHAR(o.first_sent_date, 'YYYY-MM'), TO_CHAR(o.first_sent_date, 'Mon YYYY')
    ORDER BY month;
END;
$$;

-- ============================================
-- 4. ENHANCED MONTHLY TOTALS (with value data)
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_enhanced_monthly_totals(
    p_months INTEGER DEFAULT 13,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    month TEXT,
    month_label TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    lost_opps BIGINT,
    pending_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    total_value NUMERIC,
    won_value NUMERIC,
    lost_value NUMERIC,
    value_win_rate NUMERIC,
    avg_won_deal NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(o.first_sent_date, 'YYYY-MM') AS month,
        TO_CHAR(o.first_sent_date, 'Mon YY') AS month_label,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT AS lost_opps,
        COUNT(*) FILTER (WHERE o.is_pending)::BIGINT AS pending_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1) AS closed_win_rate,
        COALESCE(SUM(
            CASE WHEN o.is_won THEN o.won_value
                 ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC AS total_value,
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value,
        COALESCE(SUM(
            CASE WHEN o.is_lost THEN o.total_quoted_value / NULLIF(o.quote_count, 0) ELSE 0 END
        ), 0)::NUMERIC AS lost_value,
        ROUND(
            COALESCE(SUM(o.won_value), 0) /
            NULLIF(SUM(
                CASE WHEN o.is_won THEN o.won_value
                     ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100
        , 1) AS value_win_rate,
        ROUND(
            COALESCE(SUM(o.won_value), 0) / NULLIF(COUNT(*) FILTER (WHERE o.is_won), 0)
        , 0) AS avg_won_deal
    FROM jobber_api_opportunities o
    WHERE
        o.first_sent_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY TO_CHAR(o.first_sent_date, 'YYYY-MM'), TO_CHAR(o.first_sent_date, 'Mon YY')
    ORDER BY month;
END;
$$;

-- ============================================
-- Verification
-- ============================================
SELECT 'Migration 267 - Additional API metrics functions created' AS status;
