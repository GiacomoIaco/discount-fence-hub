-- ============================================
-- MIGRATION 247: Fix Opportunity Value Normalization
-- ============================================
-- Problem: total_value uses max_quote_value which inflates pipeline
-- Fix: Use avg_quote_value for pending/lost, won_value for won opps
--
-- Logic:
--   Won opportunity: pipeline_value = won_value (actual converted amount)
--   Lost/Pending: pipeline_value = avg_quote_value (fair representation)
--
-- Example: 1 opp with 5 quotes ($5k-$15k), $10k quote converts
--   Old: total_value = $15k (max), win_rate = 67%
--   New: total_value = $10k (won), win_rate = 100%

-- ============================================
-- 1. ADD AVG_QUOTE_VALUE COLUMN
-- ============================================

ALTER TABLE jobber_residential_opportunities
ADD COLUMN IF NOT EXISTS avg_quote_value NUMERIC;

-- ============================================
-- 2. BACKFILL AVG_QUOTE_VALUE FROM EXISTING DATA
-- ============================================

UPDATE jobber_residential_opportunities
SET avg_quote_value = CASE
    WHEN quote_count > 0 THEN total_quoted_value / quote_count
    ELSE 0
END
WHERE avg_quote_value IS NULL;

-- ============================================
-- 3. UPDATE FUNNEL METRICS FUNCTION
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
    avg_days_to_schedule NUMERIC,
    avg_days_to_close NUMERIC,
    total_cycle_days NUMERIC
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
        -- Won value (actual converted amounts)
        COALESCE(SUM(o.won_value), 0)::NUMERIC,
        -- Quoted value (average per opportunity for fair comparison)
        COALESCE(SUM(o.avg_quote_value), 0)::NUMERIC,
        -- Total value: won_value for won opps, avg_quote_value for others
        -- This ensures 100% value win rate when all opps are won
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE COALESCE(o.avg_quote_value, 0)
            END
        ), 0)::NUMERIC,
        -- Value win rate: won_value / total_value
        ROUND(
            COALESCE(SUM(o.won_value), 0) /
            NULLIF(SUM(
                CASE
                    WHEN o.is_won THEN o.won_value
                    ELSE COALESCE(o.avg_quote_value, 0)
                END
            ), 0) * 100,
        1),
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1),
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1),
        ROUND(AVG(o.days_to_schedule) FILTER (WHERE o.is_won AND o.days_to_schedule IS NOT NULL)::NUMERIC, 1),
        ROUND(AVG(o.days_to_close) FILTER (WHERE o.is_won AND o.days_to_close IS NOT NULL)::NUMERIC, 1),
        ROUND(AVG(
            CASE
                WHEN o.is_won AND o.closed_date IS NOT NULL AND o.assessment_date IS NOT NULL
                THEN o.closed_date - o.assessment_date
                ELSE NULL
            END
        )::NUMERIC, 1)
    FROM jobber_residential_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. UPDATE SPEED METRICS FUNCTION
-- ============================================

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
    v_baseline_rate NUMERIC;
BEGIN
    -- Calculate baseline (same day rate)
    SELECT ROUND(COUNT(*) FILTER (WHERE is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1)
    INTO v_baseline_rate
    FROM jobber_residential_opportunities
    WHERE speed_to_quote_bucket = 'Same day'
        AND (p_start_date IS NULL OR first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR first_quote_date <= p_end_date)
        AND (p_salesperson IS NULL OR salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR revenue_bucket = p_revenue_bucket);

    RETURN QUERY
    SELECT
        o.speed_to_quote_bucket,
        CASE o.speed_to_quote_bucket
            WHEN 'Same day' THEN 1 WHEN '1-3 days' THEN 2
            WHEN '4-7 days' THEN 3 WHEN '8+ days' THEN 4
        END,
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1),
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) - v_baseline_rate,
        COALESCE(SUM(o.won_value), 0)::NUMERIC,
        -- Use normalized total_value (won_value for won, avg for others)
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE COALESCE(o.avg_quote_value, 0)
            END
        ), 0)::NUMERIC,
        ROUND(
            COALESCE(SUM(o.won_value), 0) /
            NULLIF(SUM(
                CASE
                    WHEN o.is_won THEN o.won_value
                    ELSE COALESCE(o.avg_quote_value, 0)
                END
            ), 0) * 100,
        1)
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

-- ============================================
-- 5. UPDATE MONTHLY TOTALS FUNCTION
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
    lost_opps BIGINT,
    win_rate NUMERIC,
    total_value NUMERIC,
    won_value NUMERIC,
    value_win_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH months AS (
        SELECT
            TO_CHAR(d, 'YYYY-MM') AS month,
            TO_CHAR(d, 'Mon YYYY') AS month_label,
            d::DATE AS month_start,
            (d + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS month_end
        FROM generate_series(
            DATE_TRUNC('month', CURRENT_DATE) - ((p_months - 1) || ' months')::INTERVAL,
            DATE_TRUNC('month', CURRENT_DATE),
            '1 month'::INTERVAL
        ) AS d
    )
    SELECT
        m.month,
        m.month_label,
        COUNT(o.*)::BIGINT AS total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT AS won_opps,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT AS lost_opps,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,
        -- Normalized total_value
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE COALESCE(o.avg_quote_value, 0)
            END
        ), 0)::NUMERIC AS total_value,
        COALESCE(SUM(o.won_value), 0)::NUMERIC AS won_value,
        ROUND(
            COALESCE(SUM(o.won_value), 0) /
            NULLIF(SUM(
                CASE
                    WHEN o.is_won THEN o.won_value
                    ELSE COALESCE(o.avg_quote_value, 0)
                END
            ), 0) * 100,
        1) AS value_win_rate
    FROM months m
    LEFT JOIN jobber_residential_opportunities o
        ON o.first_quote_date >= m.month_start
        AND o.first_quote_date <= m.month_end
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY m.month, m.month_label, m.month_start
    ORDER BY m.month;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION (run manually)
-- ============================================
/*
-- Check avg_quote_value is populated
SELECT
    COUNT(*) AS total_opps,
    COUNT(avg_quote_value) AS with_avg,
    ROUND(AVG(avg_quote_value)::NUMERIC, 2) AS avg_of_avg,
    ROUND(AVG(max_quote_value)::NUMERIC, 2) AS avg_of_max
FROM jobber_residential_opportunities;

-- Compare old vs new total_value calculation
SELECT
    SUM(max_quote_value) AS old_total_value,
    SUM(CASE WHEN is_won THEN won_value ELSE avg_quote_value END) AS new_total_value,
    SUM(won_value) AS won_value,
    ROUND(SUM(won_value) / NULLIF(SUM(max_quote_value), 0) * 100, 1) AS old_win_rate,
    ROUND(SUM(won_value) / NULLIF(SUM(CASE WHEN is_won THEN won_value ELSE avg_quote_value END), 0) * 100, 1) AS new_win_rate
FROM jobber_residential_opportunities;

-- Check multi-quote opportunities specifically
SELECT
    quote_count,
    COUNT(*) AS opps,
    ROUND(AVG(max_quote_value)::NUMERIC, 2) AS avg_max,
    ROUND(AVG(avg_quote_value)::NUMERIC, 2) AS avg_avg,
    ROUND(AVG(won_value) FILTER (WHERE is_won)::NUMERIC, 2) AS avg_won
FROM jobber_residential_opportunities
GROUP BY quote_count
ORDER BY quote_count;
*/
