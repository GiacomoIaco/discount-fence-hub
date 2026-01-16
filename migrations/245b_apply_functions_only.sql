-- Just the RPC functions that may be missing from partial migration run
-- Run with: npm run migrate:direct 245b_apply_functions_only.sql

DO $$
BEGIN
  RAISE NOTICE 'Creating/replacing RPC functions for API residential analytics...';
END $$;

-- ============================================
-- 7. FUNNEL METRICS RPC FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_funnel_metrics(
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
    won_value NUMERIC,
    avg_quote_value NUMERIC,
    avg_days_to_quote NUMERIC,
    avg_days_to_decision NUMERIC,
    avg_days_to_schedule NUMERIC,
    avg_days_to_close NUMERIC,
    avg_total_cycle NUMERIC,
    same_day_quote_pct NUMERIC
)
LANGUAGE plpgsql
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_opportunities,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opportunities,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT AS lost_opportunities,
        COUNT(*) FILTER (WHERE o.is_pending)::BIGINT AS pending_opportunities,
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.is_won OR o.is_lost) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*) FILTER (WHERE o.is_won OR o.is_lost)
            END, 1
        ) AS win_rate,
        COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) AS won_value,
        ROUND(AVG(o.max_quote_value)::NUMERIC, 0) AS avg_quote_value,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days_to_quote,
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_decision,
        ROUND(AVG(o.days_to_schedule) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_schedule,
        ROUND(AVG(o.days_to_close) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_close,
        ROUND(AVG(o.total_cycle_days) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_total_cycle,
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.days_to_quote IS NOT NULL) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day') / COUNT(*) FILTER (WHERE o.days_to_quote IS NOT NULL)
            END, 1
        ) AS same_day_quote_pct
    FROM jobber_api_opportunities o
    WHERE (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket);
END;
$fn$;

-- ============================================
-- 8. SALESPERSON METRICS RPC FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_salesperson_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    salesperson TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    pending_opps BIGINT,
    win_rate NUMERIC,
    won_value NUMERIC,
    avg_days_to_quote NUMERIC,
    same_day_pct NUMERIC
)
LANGUAGE plpgsql
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(o.salesperson, 'Unknown') AS salesperson,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        COUNT(*) FILTER (WHERE o.is_pending)::BIGINT AS pending_opps,
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.is_won OR o.is_lost) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*) FILTER (WHERE o.is_won OR o.is_lost)
            END, 1
        ) AS win_rate,
        COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) AS won_value,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days_to_quote,
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.days_to_quote IS NOT NULL) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day') / COUNT(*) FILTER (WHERE o.days_to_quote IS NOT NULL)
            END, 1
        ) AS same_day_pct
    FROM jobber_api_opportunities o
    WHERE (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.salesperson
    ORDER BY won_value DESC;
END;
$fn$;

-- ============================================
-- 9. BUCKET (PROJECT SIZE) METRICS RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_bucket_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL,
    p_speed_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    bucket TEXT,
    bucket_order INTEGER,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    won_value NUMERIC,
    avg_days_to_quote NUMERIC
)
LANGUAGE plpgsql
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        o.revenue_bucket AS bucket,
        CASE o.revenue_bucket
            WHEN 'Under $1K' THEN 1
            WHEN '$1K-$3K' THEN 2
            WHEN '$3K-$5K' THEN 3
            WHEN '$5K-$10K' THEN 4
            WHEN '$10K-$20K' THEN 5
            WHEN 'Over $20K' THEN 6
            ELSE 7
        END AS bucket_order,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.is_won OR o.is_lost) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*) FILTER (WHERE o.is_won OR o.is_lost)
            END, 1
        ) AS win_rate,
        COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) AS won_value,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days_to_quote
    FROM jobber_api_opportunities o
    WHERE o.revenue_bucket IS NOT NULL
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket)
    GROUP BY o.revenue_bucket
    ORDER BY bucket_order;
END;
$fn$;

-- ============================================
-- 10. SPEED TO QUOTE METRICS RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_speed_metrics(
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
    won_value NUMERIC,
    avg_days_to_decision NUMERIC
)
LANGUAGE plpgsql
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        o.speed_to_quote_bucket AS speed_bucket,
        CASE o.speed_to_quote_bucket
            WHEN 'Same day' THEN 1
            WHEN '1-3 days' THEN 2
            WHEN '4-7 days' THEN 3
            WHEN '8+ days' THEN 4
            ELSE 5
        END AS bucket_order,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.is_won OR o.is_lost) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*) FILTER (WHERE o.is_won OR o.is_lost)
            END, 1
        ) AS win_rate,
        COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) AS won_value,
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_decision
    FROM jobber_api_opportunities o
    WHERE o.speed_to_quote_bucket IS NOT NULL
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.speed_to_quote_bucket
    ORDER BY bucket_order;
END;
$fn$;

-- ============================================
-- 11. QUOTE COUNT METRICS RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_quote_count_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    quote_count_category TEXT,
    category_order INTEGER,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    won_value NUMERIC,
    avg_days_to_decision NUMERIC
)
LANGUAGE plpgsql
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN o.quote_count = 1 THEN 'Single Quote'
            WHEN o.quote_count = 2 THEN '2 Quotes'
            WHEN o.quote_count >= 3 THEN '3+ Quotes'
            ELSE 'Unknown'
        END AS quote_count_category,
        CASE
            WHEN o.quote_count = 1 THEN 1
            WHEN o.quote_count = 2 THEN 2
            WHEN o.quote_count >= 3 THEN 3
            ELSE 4
        END AS category_order,
        COUNT(*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE o.is_won OR o.is_lost) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE o.is_won) / COUNT(*) FILTER (WHERE o.is_won OR o.is_lost)
            END, 1
        ) AS win_rate,
        COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) AS won_value,
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) AS avg_days_to_decision
    FROM jobber_api_opportunities o
    WHERE (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY
        CASE
            WHEN o.quote_count = 1 THEN 'Single Quote'
            WHEN o.quote_count = 2 THEN '2 Quotes'
            WHEN o.quote_count >= 3 THEN '3+ Quotes'
            ELSE 'Unknown'
        END,
        CASE
            WHEN o.quote_count = 1 THEN 1
            WHEN o.quote_count = 2 THEN 2
            WHEN o.quote_count >= 3 THEN 3
            ELSE 4
        END
    ORDER BY category_order;
END;
$fn$;

-- ============================================
-- 12. MONTHLY TOTALS RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_monthly_totals(
    p_months INTEGER DEFAULT 13,
    p_revenue_bucket TEXT DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL
)
RETURNS TABLE (
    month_start DATE,
    month_label TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    won_value NUMERIC
)
LANGUAGE plpgsql
AS $fn$
BEGIN
    RETURN QUERY
    WITH months AS (
        SELECT generate_series(
            DATE_TRUNC('month', CURRENT_DATE) - ((p_months - 1) || ' months')::INTERVAL,
            DATE_TRUNC('month', CURRENT_DATE),
            '1 month'
        )::DATE AS month_start
    )
    SELECT
        m.month_start,
        TO_CHAR(m.month_start, 'Mon YYYY') AS month_label,
        COUNT(o.*)::BIGINT AS total_opps,
        COUNT(o.*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        ROUND(
            CASE
                WHEN COUNT(o.*) FILTER (WHERE o.is_won OR o.is_lost) = 0 THEN 0
                ELSE 100.0 * COUNT(o.*) FILTER (WHERE o.is_won) / COUNT(o.*) FILTER (WHERE o.is_won OR o.is_lost)
            END, 1
        ) AS win_rate,
        COALESCE(SUM(o.won_value) FILTER (WHERE o.is_won), 0) AS won_value
    FROM months m
    LEFT JOIN jobber_api_opportunities o
        ON DATE_TRUNC('month', o.first_sent_date)::DATE = m.month_start
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
    GROUP BY m.month_start
    ORDER BY m.month_start;
END;
$fn$;

-- ============================================
-- 13. CYCLE TIME BREAKDOWN RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_cycle_breakdown(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL
)
RETURNS TABLE (
    stage TEXT,
    stage_order INTEGER,
    avg_days NUMERIC,
    median_days NUMERIC,
    p25_days NUMERIC,
    p75_days NUMERIC,
    min_days INTEGER,
    max_days INTEGER,
    sample_size BIGINT
)
LANGUAGE plpgsql
AS $fn$
BEGIN
    RETURN QUERY

    -- Days to Quote (Assessment -> Sent)
    SELECT
        'Assessment -> Quote Sent'::TEXT,
        1,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_quote)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY o.days_to_quote)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.days_to_quote)::NUMERIC, 1),
        MIN(o.days_to_quote),
        MAX(o.days_to_quote),
        COUNT(*)::BIGINT
    FROM jobber_api_opportunities o
    WHERE o.days_to_quote IS NOT NULL
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)

    UNION ALL

    -- Days to Decision
    SELECT
        'Quote Sent -> Converted'::TEXT,
        2,
        ROUND(AVG(o.days_to_decision)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_decision)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY o.days_to_decision)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.days_to_decision)::NUMERIC, 1),
        MIN(o.days_to_decision),
        MAX(o.days_to_decision),
        COUNT(*)::BIGINT
    FROM jobber_api_opportunities o
    WHERE o.days_to_decision IS NOT NULL AND o.is_won
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)

    UNION ALL

    -- Days to Schedule
    SELECT
        'Converted -> Scheduled'::TEXT,
        3,
        ROUND(AVG(o.days_to_schedule)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_schedule)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY o.days_to_schedule)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.days_to_schedule)::NUMERIC, 1),
        MIN(o.days_to_schedule),
        MAX(o.days_to_schedule),
        COUNT(*)::BIGINT
    FROM jobber_api_opportunities o
    WHERE o.days_to_schedule IS NOT NULL AND o.is_won
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)

    UNION ALL

    -- Days to Close
    SELECT
        'Scheduled -> Closed'::TEXT,
        4,
        ROUND(AVG(o.days_to_close)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_close)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY o.days_to_close)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.days_to_close)::NUMERIC, 1),
        MIN(o.days_to_close),
        MAX(o.days_to_close),
        COUNT(*)::BIGINT
    FROM jobber_api_opportunities o
    WHERE o.days_to_close IS NOT NULL AND o.is_won
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)

    UNION ALL

    -- Total Cycle
    SELECT
        'Total (Assessment -> Closed)'::TEXT,
        5,
        ROUND(AVG(o.total_cycle_days)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.total_cycle_days)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY o.total_cycle_days)::NUMERIC, 1),
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.total_cycle_days)::NUMERIC, 1),
        MIN(o.total_cycle_days),
        MAX(o.total_cycle_days),
        COUNT(*)::BIGINT
    FROM jobber_api_opportunities o
    WHERE o.total_cycle_days IS NOT NULL AND o.is_won
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)

    ORDER BY stage_order;
END;
$fn$;
