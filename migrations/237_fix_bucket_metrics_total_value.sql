-- Add total_value to bucket metrics function (total quoted value, not just won)

DROP FUNCTION IF EXISTS get_residential_bucket_metrics(DATE, DATE, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_residential_bucket_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL,
    p_speed_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    revenue_bucket TEXT,
    bucket_order INTEGER,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.revenue_bucket,
        CASE o.revenue_bucket
            WHEN '$0-$1K' THEN 1 WHEN '$1K-$2K' THEN 2 WHEN '$2K-$5K' THEN 3
            WHEN '$5K-$10K' THEN 4 WHEN '$10K-$25K' THEN 5
            WHEN '$25K-$50K' THEN 6 WHEN '$50K+' THEN 7
        END AS bucket_order,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1) AS closed_win_rate,
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value,
        COALESCE(SUM(o.max_quote_value), 0)::NUMERIC AS total_value
    FROM jobber_residential_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket)
    GROUP BY o.revenue_bucket
    ORDER BY bucket_order;
END;
$$ LANGUAGE plpgsql;
