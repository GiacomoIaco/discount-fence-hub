-- ============================================
-- Enhanced Residential Analytics Functions
-- Adds: Weekly histograms, Value win rate, Win rate matrix
-- ============================================

-- ============================================
-- 1. WEEKLY HISTOGRAM (Last 13 weeks)
-- ============================================

CREATE OR REPLACE FUNCTION get_residential_weekly_totals(
    p_weeks INTEGER DEFAULT 13,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    week TEXT,
    week_label TEXT,
    week_start DATE,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(DATE_TRUNC('week', o.first_quote_date), 'IYYY-IW') AS week,
        TO_CHAR(DATE_TRUNC('week', o.first_quote_date), 'Mon DD') AS week_label,
        DATE_TRUNC('week', o.first_quote_date)::DATE AS week_start,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value,
        COALESCE(SUM(
            CASE WHEN o.is_won THEN o.won_value
                 ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC AS total_value
    FROM jobber_residential_opportunities o
    WHERE
        o.first_quote_date >= (CURRENT_DATE - (p_weeks * 7))
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY
        DATE_TRUNC('week', o.first_quote_date),
        TO_CHAR(DATE_TRUNC('week', o.first_quote_date), 'IYYY-IW'),
        TO_CHAR(DATE_TRUNC('week', o.first_quote_date), 'Mon DD')
    ORDER BY week_start;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 2. ENHANCED MONTHLY TOTALS (with value win rate)
-- ============================================

DROP FUNCTION IF EXISTS get_residential_monthly_totals(INTEGER, TEXT);

CREATE OR REPLACE FUNCTION get_residential_monthly_totals(
    p_months INTEGER DEFAULT 13,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    month TEXT,
    month_label TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    value_win_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(o.first_quote_date, 'YYYY-MM') AS month,
        TO_CHAR(o.first_quote_date, 'Mon YY') AS month_label,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value,
        -- total_value: for won use won_value, for not-won use average quote
        COALESCE(SUM(
            CASE WHEN o.is_won THEN o.won_value
                 ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC AS total_value,
        -- value_win_rate: won_value / total_value * 100
        ROUND(
            COALESCE(SUM(o.won_value), 0) /
            NULLIF(SUM(
                CASE WHEN o.is_won THEN o.won_value
                     ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100
        , 1) AS value_win_rate
    FROM jobber_residential_opportunities o
    WHERE
        o.first_quote_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY TO_CHAR(o.first_quote_date, 'YYYY-MM'), TO_CHAR(o.first_quote_date, 'Mon YY')
    ORDER BY month;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 3. WIN RATE MATRIX (Salesperson × Month)
-- ============================================

CREATE OR REPLACE FUNCTION get_residential_win_rate_matrix(
    p_months INTEGER DEFAULT 12,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    salesperson TEXT,
    month TEXT,
    month_label TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    value_win_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.salesperson,
        TO_CHAR(o.first_quote_date, 'YYYY-MM') AS month,
        TO_CHAR(o.first_quote_date, 'Mon YY') AS month_label,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
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
    FROM jobber_residential_opportunities o
    WHERE
        o.salesperson IS NOT NULL AND o.salesperson != ''
        AND o.first_quote_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.salesperson, TO_CHAR(o.first_quote_date, 'YYYY-MM'), TO_CHAR(o.first_quote_date, 'Mon YY')
    ORDER BY o.salesperson, month;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 4. WEEKLY WIN RATE MATRIX (Salesperson × Week)
-- ============================================

CREATE OR REPLACE FUNCTION get_residential_win_rate_matrix_weekly(
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
    win_rate NUMERIC,
    won_value NUMERIC,
    value_win_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.salesperson,
        TO_CHAR(DATE_TRUNC('week', o.first_quote_date), 'IYYY-IW') AS week,
        TO_CHAR(DATE_TRUNC('week', o.first_quote_date), 'Mon DD') AS week_label,
        DATE_TRUNC('week', o.first_quote_date)::DATE AS week_start,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value,
        ROUND(
            COALESCE(SUM(o.won_value), 0) /
            NULLIF(SUM(
                CASE WHEN o.is_won THEN o.won_value
                     ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100
        , 1) AS value_win_rate
    FROM jobber_residential_opportunities o
    WHERE
        o.salesperson IS NOT NULL AND o.salesperson != ''
        AND o.first_quote_date >= (CURRENT_DATE - (p_weeks * 7))
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY
        o.salesperson,
        DATE_TRUNC('week', o.first_quote_date),
        TO_CHAR(DATE_TRUNC('week', o.first_quote_date), 'IYYY-IW'),
        TO_CHAR(DATE_TRUNC('week', o.first_quote_date), 'Mon DD')
    ORDER BY o.salesperson, week_start;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 5. ENHANCED FUNNEL METRICS (with value_win_rate)
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
    avg_days_to_close NUMERIC
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
        -- total_value using smart calculation
        COALESCE(SUM(
            CASE WHEN o.is_won THEN o.won_value
                 ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC,
        -- value_win_rate
        ROUND(
            COALESCE(SUM(o.won_value), 0) /
            NULLIF(SUM(
                CASE WHEN o.is_won THEN o.won_value
                     ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100
        , 1),
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1),
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1),
        ROUND(AVG(o.days_to_close) FILTER (WHERE o.is_won)::NUMERIC, 1)
    FROM jobber_residential_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket);
END;
$$ LANGUAGE plpgsql;
