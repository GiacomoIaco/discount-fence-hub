-- ============================================
-- MIGRATION 246: Fix CSV Cycle Time Calculations
-- ============================================
-- Problem: Current system uses drafted_date instead of sent_date for cycle times
-- Fix: Add first_quote_sent_date and recalculate all cycle time metrics

-- ============================================
-- 1. ADD MISSING COLUMNS TO OPPORTUNITIES
-- ============================================

-- Add first_quote_sent_date column (the correct date for cycle time)
ALTER TABLE jobber_residential_opportunities
ADD COLUMN IF NOT EXISTS first_quote_sent_date DATE;

-- Add total_cycle_days column (will be computed)
ALTER TABLE jobber_residential_opportunities
ADD COLUMN IF NOT EXISTS total_cycle_days INTEGER;

-- ============================================
-- 2. FIX COMPUTED COLUMNS
-- ============================================
-- PostgreSQL doesn't allow direct ALTER of generated columns,
-- so we need to drop and recreate them

-- Drop old computed columns (including days_to_schedule which may exist)
ALTER TABLE jobber_residential_opportunities
DROP COLUMN IF EXISTS days_to_quote,
DROP COLUMN IF EXISTS days_to_decision,
DROP COLUMN IF EXISTS days_to_schedule,
DROP COLUMN IF EXISTS days_to_close,
DROP COLUMN IF EXISTS speed_to_quote_bucket;

-- Recreate days_to_quote: Assessment → First SENT (not drafted)
ALTER TABLE jobber_residential_opportunities
ADD COLUMN days_to_quote INTEGER GENERATED ALWAYS AS (
    CASE
        WHEN first_quote_sent_date IS NOT NULL AND assessment_date IS NOT NULL
             AND first_quote_sent_date >= assessment_date
        THEN first_quote_sent_date - assessment_date
        ELSE NULL
    END
) STORED;

-- Recreate days_to_decision: First SENT → Converted (won_date)
ALTER TABLE jobber_residential_opportunities
ADD COLUMN days_to_decision INTEGER GENERATED ALWAYS AS (
    CASE
        WHEN won_date IS NOT NULL AND first_quote_sent_date IS NOT NULL
             AND won_date >= first_quote_sent_date
        THEN won_date - first_quote_sent_date
        ELSE NULL
    END
) STORED;

-- Add days_to_schedule: Converted → Job Scheduled (NEW)
ALTER TABLE jobber_residential_opportunities
ADD COLUMN days_to_schedule INTEGER GENERATED ALWAYS AS (
    CASE
        WHEN scheduled_date IS NOT NULL AND won_date IS NOT NULL
             AND scheduled_date >= won_date
        THEN scheduled_date - won_date
        ELSE NULL
    END
) STORED;

-- Fix days_to_close: Job Scheduled → Job Closed (not Quote → Closed)
ALTER TABLE jobber_residential_opportunities
ADD COLUMN days_to_close INTEGER GENERATED ALWAYS AS (
    CASE
        WHEN closed_date IS NOT NULL AND scheduled_date IS NOT NULL
             AND closed_date >= scheduled_date
        THEN closed_date - scheduled_date
        ELSE NULL
    END
) STORED;

-- Recreate speed_to_quote_bucket (based on sent date now)
ALTER TABLE jobber_residential_opportunities
ADD COLUMN speed_to_quote_bucket TEXT GENERATED ALWAYS AS (
    CASE
        WHEN first_quote_sent_date IS NULL OR assessment_date IS NULL THEN NULL
        WHEN first_quote_sent_date < assessment_date THEN NULL
        WHEN first_quote_sent_date - assessment_date = 0 THEN 'Same day'
        WHEN first_quote_sent_date - assessment_date <= 3 THEN '1-3 days'
        WHEN first_quote_sent_date - assessment_date <= 7 THEN '4-7 days'
        ELSE '8+ days'
    END
) STORED;

-- ============================================
-- 3. CREATE REQUESTS TABLE FOR CSV SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS jobber_residential_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Unique key for matching (client + address)
    request_key TEXT,

    -- Client & Address
    client_name TEXT,
    client_name_normalized TEXT,
    service_street TEXT,
    service_street_normalized TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,

    -- Dates
    requested_date DATE,       -- When request was created
    assessment_date DATE,      -- When assessment scheduled/completed

    -- Request details
    form_name TEXT,            -- Form type (product type indicator)
    request_title TEXT,
    status TEXT,

    -- Assignment
    assessment_assigned_to TEXT,

    -- Custom fields
    description_of_work TEXT,
    size_of_project TEXT,
    source TEXT,
    additional_rep TEXT,
    online_booking BOOLEAN DEFAULT FALSE,

    -- Linkage
    quote_numbers TEXT,        -- Linked quotes (comma-separated)
    job_numbers TEXT,          -- Linked jobs (comma-separated)

    -- Import tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint on request_key for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_res_requests_key
ON jobber_residential_requests(request_key)
WHERE request_key IS NOT NULL;

-- Indexes for requests
CREATE INDEX IF NOT EXISTS idx_res_requests_assessment_date
ON jobber_residential_requests(assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_res_requests_form_name
ON jobber_residential_requests(form_name);

-- Enable RLS
ALTER TABLE jobber_residential_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
DROP POLICY IF EXISTS "residential_request_authenticated_access" ON jobber_residential_requests;
CREATE POLICY "residential_request_authenticated_access"
ON jobber_residential_requests
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 4. ADD WARRANTY TRACKING TO JOBS
-- ============================================

-- Add is_warranty computed column
ALTER TABLE jobber_residential_jobs
ADD COLUMN IF NOT EXISTS is_warranty BOOLEAN GENERATED ALWAYS AS (
    total_revenue = 0 OR total_revenue IS NULL
) STORED;

-- Index for warranty queries
CREATE INDEX IF NOT EXISTS idx_res_jobs_is_warranty
ON jobber_residential_jobs(is_warranty)
WHERE is_warranty = TRUE;

-- ============================================
-- 5. UPDATE RPC FUNCTIONS
-- ============================================

-- Drop and recreate funnel metrics function with new columns
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
        COALESCE(SUM(o.won_value), 0)::NUMERIC,
        COALESCE(SUM(o.max_quote_value), 0)::NUMERIC,
        COALESCE(SUM(o.max_quote_value), 0)::NUMERIC,  -- total_value = quoted_value for now
        ROUND(COALESCE(SUM(o.won_value), 0) / NULLIF(SUM(o.max_quote_value), 0) * 100, 1),
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

-- Add function for warranty job metrics
CREATE OR REPLACE FUNCTION get_residential_warranty_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_baseline_weeks INTEGER DEFAULT 8
)
RETURNS TABLE (
    warranty_count BIGINT,
    paid_count BIGINT,
    warranty_percent NUMERIC,
    baseline_weekly_avg NUMERIC
) AS $$
DECLARE
    v_baseline_start DATE;
    v_period_start DATE;
    v_period_end DATE;
    v_period_weeks NUMERIC;
BEGIN
    -- Set period dates
    v_period_end := COALESCE(p_end_date, CURRENT_DATE);
    v_period_start := COALESCE(p_start_date, v_period_end - INTERVAL '30 days');
    v_baseline_start := v_period_end - (p_baseline_weeks || ' weeks')::INTERVAL;
    v_period_weeks := GREATEST(1, EXTRACT(DAY FROM (v_period_end - v_period_start)) / 7.0);

    RETURN QUERY
    WITH warranty_in_period AS (
        SELECT COUNT(*)::BIGINT AS cnt
        FROM jobber_residential_jobs
        WHERE is_warranty = TRUE
            AND closed_date >= v_period_start
            AND closed_date <= v_period_end
    ),
    paid_in_period AS (
        SELECT COUNT(*)::BIGINT AS cnt
        FROM jobber_residential_jobs
        WHERE is_warranty = FALSE
            AND closed_date >= v_period_start
            AND closed_date <= v_period_end
    ),
    baseline_paid AS (
        SELECT COUNT(*)::BIGINT AS cnt
        FROM jobber_residential_jobs
        WHERE is_warranty = FALSE
            AND closed_date >= v_baseline_start
            AND closed_date <= v_period_end
    )
    SELECT
        w.cnt AS warranty_count,
        p.cnt AS paid_count,
        ROUND(w.cnt::NUMERIC / NULLIF((b.cnt::NUMERIC / p_baseline_weeks * v_period_weeks), 0) * 100, 1) AS warranty_percent,
        ROUND(b.cnt::NUMERIC / p_baseline_weeks, 1) AS baseline_weekly_avg
    FROM warranty_in_period w, paid_in_period p, baseline_paid b;
END;
$$ LANGUAGE plpgsql;

-- Add function for request metrics (assessments scheduled)
CREATE OR REPLACE FUNCTION get_residential_request_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_requests BIGINT,
    assessments_scheduled BIGINT,
    by_form_name JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_requests,
        COUNT(*) FILTER (WHERE r.assessment_date IS NOT NULL)::BIGINT AS assessments_scheduled,
        COALESCE(
            jsonb_object_agg(
                COALESCE(r.form_name, 'Unknown'),
                form_counts.cnt
            ),
            '{}'::JSONB
        ) AS by_form_name
    FROM jobber_residential_requests r
    LEFT JOIN (
        SELECT form_name, COUNT(*)::BIGINT AS cnt
        FROM jobber_residential_requests
        WHERE (p_start_date IS NULL OR assessment_date >= p_start_date)
            AND (p_end_date IS NULL OR assessment_date <= p_end_date)
        GROUP BY form_name
    ) form_counts ON form_counts.form_name = r.form_name
    WHERE
        (p_start_date IS NULL OR r.assessment_date >= p_start_date)
        AND (p_end_date IS NULL OR r.assessment_date <= p_end_date);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. UPDATE SPEED METRICS FUNCTION
-- ============================================

-- Update speed metrics to use sent_date based buckets
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
        COALESCE(SUM(o.max_quote_value), 0)::NUMERIC,
        ROUND(COALESCE(SUM(o.won_value), 0) / NULLIF(SUM(o.max_quote_value), 0) * 100, 1)
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
-- 7. BACKFILL first_quote_sent_date FROM QUOTES
-- ============================================

-- Update existing opportunities with first_quote_sent_date from quotes
UPDATE jobber_residential_opportunities o
SET first_quote_sent_date = subq.first_sent
FROM (
    SELECT
        opportunity_key,
        MIN(sent_date) AS first_sent
    FROM jobber_residential_quotes
    WHERE sent_date IS NOT NULL
    GROUP BY opportunity_key
) subq
WHERE o.opportunity_key = subq.opportunity_key;

-- ============================================
-- VERIFICATION QUERIES (run manually)
-- ============================================
/*
-- Check that first_quote_sent_date is populated
SELECT
    COUNT(*) AS total_opps,
    COUNT(first_quote_sent_date) AS with_sent_date,
    COUNT(first_quote_date) AS with_drafted_date,
    COUNT(assessment_date) AS with_assessment
FROM jobber_residential_opportunities;

-- Compare old vs new days_to_quote
SELECT
    AVG(first_quote_date - assessment_date) AS old_days_to_quote,
    AVG(first_quote_sent_date - assessment_date) AS new_days_to_quote,
    AVG(first_quote_sent_date - first_quote_date) AS sent_minus_drafted
FROM jobber_residential_opportunities
WHERE first_quote_date IS NOT NULL
  AND first_quote_sent_date IS NOT NULL
  AND assessment_date IS NOT NULL;

-- Check speed bucket distribution
SELECT speed_to_quote_bucket, COUNT(*),
       ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER() * 100, 1) AS pct
FROM jobber_residential_opportunities
WHERE speed_to_quote_bucket IS NOT NULL
GROUP BY speed_to_quote_bucket
ORDER BY 1;

-- Verify warranty jobs
SELECT is_warranty, COUNT(*)
FROM jobber_residential_jobs
GROUP BY is_warranty;
*/
