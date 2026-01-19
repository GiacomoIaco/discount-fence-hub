-- ============================================
-- Migration 266: Extended API Residential Metrics
-- ============================================
-- Adds missing RPC functions for full parity with CSV dashboard:
-- - Weekly totals
-- - Win rate matrix (salesperson x month)
-- - Extended salesperson metrics (with p75)
-- ============================================

-- ============================================
-- 1. WEEKLY TOTALS (Last N weeks)
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_weekly_totals(
    p_weeks INTEGER DEFAULT 13,
    p_revenue_bucket TEXT DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL
)
RETURNS TABLE (
    week TEXT,
    week_label TEXT,
    week_start DATE,
    total_opps BIGINT,
    won_opps BIGINT,
    lost_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(DATE_TRUNC('week', o.first_sent_date), 'IYYY-IW') AS week,
        TO_CHAR(DATE_TRUNC('week', o.first_sent_date), 'Mon DD') AS week_label,
        DATE_TRUNC('week', o.first_sent_date)::DATE AS week_start,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT AS lost_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1) AS closed_win_rate,
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value,
        COALESCE(SUM(
            CASE WHEN o.is_won THEN o.won_value
                 ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC AS total_value
    FROM jobber_api_opportunities o
    WHERE
        o.first_sent_date >= (CURRENT_DATE - (p_weeks * 7))
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
    GROUP BY
        DATE_TRUNC('week', o.first_sent_date),
        TO_CHAR(DATE_TRUNC('week', o.first_sent_date), 'IYYY-IW'),
        TO_CHAR(DATE_TRUNC('week', o.first_sent_date), 'Mon DD')
    ORDER BY week_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. WIN RATE MATRIX (Salesperson x Month)
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_win_rate_matrix(
    p_months INTEGER DEFAULT 12,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    salesperson TEXT,
    month TEXT,
    month_label TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    lost_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    value_win_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.salesperson,
        TO_CHAR(o.first_sent_date, 'YYYY-MM') AS month,
        TO_CHAR(o.first_sent_date, 'Mon YY') AS month_label,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT AS lost_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1) AS closed_win_rate,
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value,
        COALESCE(SUM(
            CASE WHEN o.is_won THEN o.won_value
                 ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC AS total_value,
        ROUND(
            COALESCE(SUM(o.won_value), 0) /
            NULLIF(SUM(
                CASE WHEN o.is_won THEN o.won_value
                     ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100
        , 1) AS value_win_rate
    FROM jobber_api_opportunities o
    WHERE
        o.salesperson IS NOT NULL AND o.salesperson != ''
        AND o.first_sent_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.salesperson, TO_CHAR(o.first_sent_date, 'YYYY-MM'), TO_CHAR(o.first_sent_date, 'Mon YY')
    ORDER BY o.salesperson, month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. WIN RATE MATRIX WEEKLY (Salesperson x Week)
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_win_rate_matrix_weekly(
    p_weeks INTEGER DEFAULT 13,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    salesperson TEXT,
    week TEXT,
    week_label TEXT,
    week_start DATE,
    total_opps BIGINT,
    won_opps BIGINT,
    lost_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    value_win_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.salesperson,
        TO_CHAR(DATE_TRUNC('week', o.first_sent_date), 'IYYY-IW') AS week,
        TO_CHAR(DATE_TRUNC('week', o.first_sent_date), 'Mon DD') AS week_label,
        DATE_TRUNC('week', o.first_sent_date)::DATE AS week_start,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT AS lost_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1) AS closed_win_rate,
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value,
        ROUND(
            COALESCE(SUM(o.won_value), 0) /
            NULLIF(SUM(
                CASE WHEN o.is_won THEN o.won_value
                     ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100
        , 1) AS value_win_rate
    FROM jobber_api_opportunities o
    WHERE
        o.salesperson IS NOT NULL AND o.salesperson != ''
        AND o.first_sent_date >= (CURRENT_DATE - (p_weeks * 7))
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY
        o.salesperson,
        DATE_TRUNC('week', o.first_sent_date),
        TO_CHAR(DATE_TRUNC('week', o.first_sent_date), 'IYYY-IW'),
        TO_CHAR(DATE_TRUNC('week', o.first_sent_date), 'Mon DD')
    ORDER BY o.salesperson, week_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. EXTENDED SALESPERSON METRICS (with percentiles)
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_salesperson_extended_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    salesperson TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    lost_opps BIGINT,
    pending_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    avg_won_value NUMERIC,
    avg_days_to_quote NUMERIC,
    p75_days_to_quote NUMERIC,
    avg_days_to_decision NUMERIC,
    p75_days_to_decision NUMERIC,
    same_day_pct NUMERIC,
    multi_quote_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.salesperson,
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_pending)::BIGINT,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1),
        COALESCE(SUM(o.won_value), 0)::NUMERIC,
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC,
        ROUND(COALESCE(SUM(o.won_value), 0) / NULLIF(COUNT(*) FILTER (WHERE o.is_won), 0), 0),
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.days_to_quote)::NUMERIC, 1),
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1),
        ROUND((COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::NUMERIC /
               NULLIF(COUNT(*) FILTER (WHERE o.speed_to_quote_bucket IS NOT NULL), 0) * 100), 1),
        ROUND((COUNT(*) FILTER (WHERE o.quote_count > 1)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1)
    FROM jobber_api_opportunities o
    WHERE
        o.salesperson IS NOT NULL AND o.salesperson != ''
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.salesperson
    ORDER BY won_value DESC;
END;
$$;

-- ============================================
-- 5. TRENDS FUNCTION (Monthly with rolling averages)
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_trends(
    p_months INTEGER DEFAULT 13,
    p_salesperson TEXT DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    month TEXT,
    month_label TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    lost_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    value_win_rate NUMERIC,
    avg_days_to_quote NUMERIC,
    avg_days_to_decision NUMERIC
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
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1) AS closed_win_rate,
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value,
        COALESCE(SUM(
            CASE WHEN o.is_won THEN o.won_value
                 ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC AS total_value,
        ROUND(
            COALESCE(SUM(o.won_value), 0) /
            NULLIF(SUM(
                CASE WHEN o.is_won THEN o.won_value
                     ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100
        , 1) AS value_win_rate,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days_to_quote,
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_decision
    FROM jobber_api_opportunities o
    WHERE
        o.first_sent_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY TO_CHAR(o.first_sent_date, 'YYYY-MM'), TO_CHAR(o.first_sent_date, 'Mon YY')
    ORDER BY month;
END;
$$;

-- ============================================
-- 6. SPEED x SIZE HEATMAP (Matrix)
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_speed_size_matrix(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL
)
RETURNS TABLE (
    speed_bucket TEXT,
    speed_order INTEGER,
    revenue_bucket TEXT,
    revenue_order INTEGER,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.speed_to_quote_bucket AS speed_bucket,
        CASE o.speed_to_quote_bucket
            WHEN 'Same day' THEN 1
            WHEN '1-3 days' THEN 2
            WHEN '4-7 days' THEN 3
            WHEN '8+ days' THEN 4
        END AS speed_order,
        o.revenue_bucket,
        CASE o.revenue_bucket
            WHEN '$0-$1K' THEN 1 WHEN '$1K-$2K' THEN 2 WHEN '$2K-$5K' THEN 3
            WHEN '$5K-$10K' THEN 4 WHEN '$10K-$25K' THEN 5
            WHEN '$25K-$50K' THEN 6 WHEN '$50K+' THEN 7
        END AS revenue_order,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1) AS closed_win_rate,
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value
    FROM jobber_api_opportunities o
    WHERE
        o.speed_to_quote_bucket IS NOT NULL
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
    GROUP BY o.speed_to_quote_bucket, o.revenue_bucket
    ORDER BY speed_order, revenue_order;
END;
$$;

-- ============================================
-- Verification
-- ============================================
SELECT 'Migration 266 - Extended API metrics functions created' AS status;
