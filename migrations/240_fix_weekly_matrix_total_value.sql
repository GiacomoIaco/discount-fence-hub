-- Add total_value to weekly win rate matrix function

DROP FUNCTION IF EXISTS get_residential_win_rate_matrix_weekly(INTEGER, TEXT);

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
    total_value NUMERIC,
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
