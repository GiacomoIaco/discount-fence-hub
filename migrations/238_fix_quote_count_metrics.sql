-- Add won_value to quote count metrics function

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
    won_value NUMERIC
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
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value
    FROM jobber_residential_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.quote_count_bucket
    ORDER BY bucket_order;
END;
$$ LANGUAGE plpgsql;
