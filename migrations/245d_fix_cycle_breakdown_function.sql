-- Fix the ORDER BY clause in cycle breakdown function
-- PostgreSQL requires column position (not alias) for ORDER BY in UNION queries

DROP FUNCTION IF EXISTS get_api_residential_cycle_breakdown(DATE, DATE, TEXT);

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
    SELECT * FROM (
        -- Days to Quote (Assessment -> Sent)
        SELECT
            'Assessment -> Quote Sent'::TEXT AS stage,
            1 AS stage_order,
            ROUND(AVG(o.days_to_quote)::NUMERIC, 1) AS avg_days,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.days_to_quote)::NUMERIC, 1) AS median_days,
            ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY o.days_to_quote)::NUMERIC, 1) AS p25_days,
            ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.days_to_quote)::NUMERIC, 1) AS p75_days,
            MIN(o.days_to_quote) AS min_days,
            MAX(o.days_to_quote) AS max_days,
            COUNT(*)::BIGINT AS sample_size
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
    ) sub
    ORDER BY sub.stage_order;
END;
$fn$;
