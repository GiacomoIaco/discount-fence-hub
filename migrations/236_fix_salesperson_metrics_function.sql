-- Fix ambiguous column reference in get_residential_salesperson_metrics
-- The return column 'won_value' conflicts with the table column 'won_value'

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
