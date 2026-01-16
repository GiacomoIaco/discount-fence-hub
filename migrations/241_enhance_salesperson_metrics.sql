-- Enhance salesperson metrics to include total_value and value_win_rate

DROP FUNCTION IF EXISTS get_residential_salesperson_metrics(DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION get_residential_salesperson_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    salesperson TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    lost_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    value_win_rate NUMERIC,
    avg_won_value NUMERIC,
    avg_days_to_quote NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.salesperson,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT AS lost_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1) AS closed_win_rate,
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
        , 1) AS value_win_rate,
        ROUND(COALESCE(SUM(o.won_value), 0) / NULLIF(COUNT(*) FILTER (WHERE o.is_won), 0), 0) AS avg_won_value,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days_to_quote
    FROM jobber_residential_opportunities o
    WHERE
        o.salesperson IS NOT NULL AND o.salesperson != ''
        AND (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.salesperson
    ORDER BY COALESCE(SUM(o.won_value), 0) DESC;
END;
$$ LANGUAGE plpgsql;


-- Also enhance speed metrics to include value info
DROP FUNCTION IF EXISTS get_residential_speed_metrics(DATE, DATE, TEXT, TEXT);

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
) AS $$
DECLARE
    baseline_win_rate NUMERIC;
BEGIN
    -- Calculate baseline (same-day win rate)
    SELECT ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1)
    INTO baseline_win_rate
    FROM jobber_residential_opportunities o
    WHERE
        o.speed_to_quote_bucket = 'Same day'
        AND (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket);

    RETURN QUERY
    SELECT
        o.speed_to_quote_bucket AS speed_bucket,
        CASE o.speed_to_quote_bucket
            WHEN 'Same day' THEN 1 WHEN '1-3 days' THEN 2
            WHEN '4-7 days' THEN 3 WHEN '8+ days' THEN 4
        END AS bucket_order,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1) AS closed_win_rate,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) - baseline_win_rate AS baseline_diff,
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
        o.speed_to_quote_bucket IS NOT NULL
        AND (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.speed_to_quote_bucket
    ORDER BY bucket_order;
END;
$$ LANGUAGE plpgsql;


-- Enhance quote count metrics to include total_value and value_win_rate
DROP FUNCTION IF EXISTS get_residential_quote_count_metrics(DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION get_residential_quote_count_metrics(
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
    won_value NUMERIC,
    total_value NUMERIC,
    value_win_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.quote_count_bucket,
        CASE o.quote_count_bucket
            WHEN '1 quote' THEN 1 WHEN '2 quotes' THEN 2
            WHEN '3 quotes' THEN 3 WHEN '4+ quotes' THEN 4
        END AS bucket_order,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
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
    FROM jobber_residential_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.quote_count_bucket
    ORDER BY bucket_order;
END;
$$ LANGUAGE plpgsql;
