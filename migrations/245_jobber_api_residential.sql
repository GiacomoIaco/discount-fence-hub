-- ============================================
-- RESIDENTIAL ANALYTICS (API-SOURCED)
-- Migration 245: Tables, indexes, functions for Jobber API data
-- ============================================
--
-- This migration creates a PARALLEL set of tables for API-synced data
-- to allow side-by-side comparison with CSV-imported data (migration 235).
--
-- KEY DIFFERENCE: Cycle times use SENT date (not drafted date)
-- - Days to Quote:    Assessment → First SENT
-- - Days to Decision: First Sent → Converted
-- - Days to Schedule: Converted → Scheduled
-- - Days to Close:    Scheduled → Closed
-- ============================================

-- ============================================
-- 1. RAW QUOTES TABLE (from Jobber API)
-- ============================================

CREATE TABLE IF NOT EXISTS jobber_api_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Jobber identifiers
    jobber_id TEXT NOT NULL UNIQUE,
    quote_number INTEGER NOT NULL,

    -- Client & Address (denormalized from API)
    client_jobber_id TEXT,
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    service_street TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,

    -- Quote details
    title TEXT,
    status TEXT, -- draft, awaiting_response, approved, converted, archived
    total DECIMAL(12,2) DEFAULT 0,
    subtotal DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,

    -- People
    salesperson TEXT, -- Will need to extract from assignedTo or customFields
    created_by TEXT,

    -- KEY DATES (from API)
    drafted_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,        -- CRITICAL: This is what we use for "Days to Quote"
    approved_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,   -- When quote became a job

    -- Linkage
    job_jobber_ids TEXT[],      -- Array of job IDs created from this quote
    request_jobber_id TEXT,     -- Request this quote is linked to

    -- Sync metadata
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    raw_data JSONB,             -- Store full API response for debugging

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quotes
CREATE INDEX IF NOT EXISTS idx_api_quotes_jobber_id ON jobber_api_quotes(jobber_id);
CREATE INDEX IF NOT EXISTS idx_api_quotes_number ON jobber_api_quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_api_quotes_status ON jobber_api_quotes(status);
CREATE INDEX IF NOT EXISTS idx_api_quotes_sent_at ON jobber_api_quotes(sent_at);
CREATE INDEX IF NOT EXISTS idx_api_quotes_client ON jobber_api_quotes(client_jobber_id);

-- ============================================
-- 2. RAW JOBS TABLE (from Jobber API)
-- ============================================

CREATE TABLE IF NOT EXISTS jobber_api_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Jobber identifiers
    jobber_id TEXT NOT NULL UNIQUE,
    job_number INTEGER NOT NULL,

    -- Client & Address
    client_jobber_id TEXT,
    client_name TEXT,
    service_street TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,

    -- Job details
    title TEXT,
    status TEXT, -- requires_invoicing, awaiting_payment, late, complete, archived, etc.

    -- Financials
    total DECIMAL(12,2) DEFAULT 0,
    invoiced_total DECIMAL(12,2) DEFAULT 0,

    -- KEY DATES
    created_at_jobber TIMESTAMPTZ,
    scheduled_start_at TIMESTAMPTZ,  -- When job is scheduled to start
    completed_at TIMESTAMPTZ,        -- When job was marked complete
    closed_at TIMESTAMPTZ,           -- When job was closed/archived

    -- Linkage
    quote_jobber_id TEXT,
    quote_number INTEGER,

    -- Sync metadata
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    raw_data JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for jobs
CREATE INDEX IF NOT EXISTS idx_api_jobs_jobber_id ON jobber_api_jobs(jobber_id);
CREATE INDEX IF NOT EXISTS idx_api_jobs_number ON jobber_api_jobs(job_number);
CREATE INDEX IF NOT EXISTS idx_api_jobs_quote ON jobber_api_jobs(quote_jobber_id);
CREATE INDEX IF NOT EXISTS idx_api_jobs_scheduled ON jobber_api_jobs(scheduled_start_at);

-- ============================================
-- 3. RAW REQUESTS TABLE (from Jobber API)
-- ============================================

CREATE TABLE IF NOT EXISTS jobber_api_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Jobber identifiers
    jobber_id TEXT NOT NULL UNIQUE,
    request_number INTEGER,

    -- Client & Address
    client_jobber_id TEXT,
    client_name TEXT,
    service_street TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,

    -- Request details
    title TEXT,
    status TEXT,

    -- KEY DATE: Assessment
    assessment_start_at TIMESTAMPTZ,  -- When assessment was scheduled
    assessment_completed_at TIMESTAMPTZ,

    -- Linkage
    quote_jobber_ids TEXT[],

    -- Sync metadata
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    raw_data JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for requests
CREATE INDEX IF NOT EXISTS idx_api_requests_jobber_id ON jobber_api_requests(jobber_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_client ON jobber_api_requests(client_jobber_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_assessment ON jobber_api_requests(assessment_start_at);

-- ============================================
-- 4. COMPUTED OPPORTUNITIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS jobber_api_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Unique identifier (normalized client + address)
    opportunity_key TEXT NOT NULL UNIQUE,

    -- Client & Address (normalized)
    client_name TEXT,
    client_name_normalized TEXT,
    client_email TEXT,
    client_phone TEXT,
    service_street TEXT,
    service_street_normalized TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,

    -- Assignment
    salesperson TEXT,

    -- Quote Aggregations
    quote_count INTEGER DEFAULT 1,
    quote_numbers TEXT,              -- Comma-separated list
    quote_jobber_ids TEXT[],         -- Array for lookups
    first_quote_sent_at TIMESTAMPTZ, -- CORRECTED: First SENT date (not drafted)
    last_quote_sent_at TIMESTAMPTZ,

    -- Values
    max_quote_value DECIMAL(12,2) DEFAULT 0,
    min_quote_value DECIMAL(12,2) DEFAULT 0,
    total_quoted_value DECIMAL(12,2) DEFAULT 0,
    won_value DECIMAL(12,2) DEFAULT 0,

    -- Conversion Status
    is_won BOOLEAN DEFAULT FALSE,
    is_lost BOOLEAN DEFAULT FALSE,
    is_pending BOOLEAN DEFAULT TRUE,
    won_date DATE,
    won_quote_numbers TEXT,

    -- From Jobs (enrichment)
    job_count INTEGER DEFAULT 0,
    job_numbers TEXT,
    job_jobber_ids TEXT[],
    scheduled_date DATE,
    closed_date DATE,
    actual_revenue DECIMAL(12,2),

    -- From Requests (for speed-to-quote)
    request_jobber_id TEXT,
    assessment_date DATE,

    -- CYCLE TIMES (computed by compute_api_opportunities function)
    -- Days to Quote: Assessment → First SENT (not drafted)
    first_sent_date DATE,  -- Extracted from first_quote_sent_at for computations
    days_to_quote INTEGER,

    -- Speed bucket based on days_to_quote
    speed_to_quote_bucket TEXT,

    -- Days to Decision: First Sent → Converted (client acceptance time)
    days_to_decision INTEGER,

    -- Days to Schedule: Converted → Scheduled
    days_to_schedule INTEGER,

    -- Days to Close: Scheduled → Closed (work execution time)
    days_to_close INTEGER,

    -- Total Cycle: Assessment → Closed
    total_cycle_days INTEGER,

    -- Revenue bucket (computed)
    revenue_bucket TEXT,

    -- Quote count bucket (computed)
    quote_count_bucket TEXT,

    -- Tracking
    last_computed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for opportunities
CREATE INDEX IF NOT EXISTS idx_api_opp_key ON jobber_api_opportunities(opportunity_key);
CREATE INDEX IF NOT EXISTS idx_api_opp_salesperson ON jobber_api_opportunities(salesperson);
CREATE INDEX IF NOT EXISTS idx_api_opp_is_won ON jobber_api_opportunities(is_won);
CREATE INDEX IF NOT EXISTS idx_api_opp_revenue_bucket ON jobber_api_opportunities(revenue_bucket);
CREATE INDEX IF NOT EXISTS idx_api_opp_speed_bucket ON jobber_api_opportunities(speed_to_quote_bucket);
CREATE INDEX IF NOT EXISTS idx_api_opp_quote_count_bucket ON jobber_api_opportunities(quote_count_bucket);
CREATE INDEX IF NOT EXISTS idx_api_opp_first_sent ON jobber_api_opportunities(first_sent_date DESC);
CREATE INDEX IF NOT EXISTS idx_api_opp_assessment ON jobber_api_opportunities(assessment_date);

-- ============================================
-- 5. RLS POLICIES
-- ============================================

ALTER TABLE jobber_api_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobber_api_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobber_api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobber_api_opportunities ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all
CREATE POLICY "api_quotes_authenticated_read" ON jobber_api_quotes
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "api_jobs_authenticated_read" ON jobber_api_jobs
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "api_requests_authenticated_read" ON jobber_api_requests
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "api_opp_authenticated_read" ON jobber_api_opportunities
    FOR SELECT TO authenticated USING (true);

-- Service role can do everything (for sync functions)
-- Note: service_role bypasses RLS by default, but adding explicit policies for clarity

-- ============================================
-- 6. COMPUTE OPPORTUNITIES FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION compute_api_opportunities()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Truncate and rebuild opportunities from raw data
    TRUNCATE TABLE jobber_api_opportunities;

    -- Insert opportunities aggregated from quotes
    INSERT INTO jobber_api_opportunities (
        opportunity_key,
        client_name,
        client_name_normalized,
        client_email,
        service_street,
        service_street_normalized,
        service_city,
        service_state,
        service_zip,
        salesperson,
        quote_count,
        quote_numbers,
        quote_jobber_ids,
        first_quote_sent_at,
        last_quote_sent_at,
        max_quote_value,
        min_quote_value,
        total_quoted_value,
        won_value,
        is_won,
        is_pending,
        won_date,
        won_quote_numbers,
        last_computed_at
    )
    SELECT
        -- Opportunity key: normalized client name + street
        LOWER(TRIM(COALESCE(q.client_name, ''))) || '|' ||
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(q.service_street, '')), '[^a-z0-9]', '', 'gi')) AS opportunity_key,

        -- Client info (from first quote)
        MAX(q.client_name) AS client_name,
        LOWER(TRIM(MAX(q.client_name))) AS client_name_normalized,
        MAX(q.client_email) AS client_email,

        -- Address (from first quote)
        MAX(q.service_street) AS service_street,
        LOWER(REGEXP_REPLACE(TRIM(MAX(q.service_street)), '[^a-z0-9]', '', 'gi')) AS service_street_normalized,
        MAX(q.service_city) AS service_city,
        MAX(q.service_state) AS service_state,
        MAX(q.service_zip) AS service_zip,

        -- Salesperson (from most recent quote)
        (SELECT sq.salesperson FROM jobber_api_quotes sq
         WHERE sq.client_name = MAX(q.client_name)
           AND COALESCE(sq.service_street, '') = COALESCE(MAX(q.service_street), '')
         ORDER BY sq.sent_at DESC NULLS LAST LIMIT 1) AS salesperson,

        -- Quote aggregations
        COUNT(DISTINCT q.quote_number)::INTEGER AS quote_count,
        STRING_AGG(DISTINCT q.quote_number::TEXT, ', ' ORDER BY q.quote_number::TEXT) AS quote_numbers,
        ARRAY_AGG(DISTINCT q.jobber_id) AS quote_jobber_ids,
        MIN(q.sent_at) FILTER (WHERE q.sent_at IS NOT NULL) AS first_quote_sent_at,
        MAX(q.sent_at) AS last_quote_sent_at,

        -- Values
        MAX(q.total) AS max_quote_value,
        MIN(q.total) FILTER (WHERE q.total > 0) AS min_quote_value,
        SUM(q.total) AS total_quoted_value,

        -- Won value (sum of converted quotes)
        COALESCE(SUM(q.total) FILTER (WHERE q.status = 'converted'), 0) AS won_value,

        -- Status
        BOOL_OR(q.status = 'converted') AS is_won,
        NOT BOOL_OR(q.status = 'converted') AND NOT BOOL_OR(q.status = 'archived') AS is_pending,

        -- Won date (earliest converted_at)
        MIN(q.converted_at::DATE) FILTER (WHERE q.status = 'converted') AS won_date,
        STRING_AGG(DISTINCT q.quote_number::TEXT, ', ') FILTER (WHERE q.status = 'converted') AS won_quote_numbers,

        NOW() AS last_computed_at
    FROM jobber_api_quotes q
    WHERE q.sent_at IS NOT NULL  -- Only include sent quotes
    GROUP BY
        LOWER(TRIM(COALESCE(q.client_name, ''))) || '|' ||
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(q.service_street, '')), '[^a-z0-9]', '', 'gi'));

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Update job linkage
    UPDATE jobber_api_opportunities o
    SET
        job_count = sub.job_count,
        job_numbers = sub.job_numbers,
        job_jobber_ids = sub.job_jobber_ids,
        scheduled_date = sub.scheduled_date,
        closed_date = sub.closed_date,
        actual_revenue = sub.actual_revenue
    FROM (
        SELECT
            q.jobber_id AS quote_jobber_id,
            COUNT(DISTINCT j.job_number) AS job_count,
            STRING_AGG(DISTINCT j.job_number::TEXT, ', ') AS job_numbers,
            ARRAY_AGG(DISTINCT j.jobber_id) FILTER (WHERE j.jobber_id IS NOT NULL) AS job_jobber_ids,
            MIN(j.scheduled_start_at::DATE) AS scheduled_date,
            MAX(COALESCE(j.closed_at, j.completed_at)::DATE) AS closed_date,
            SUM(j.total) AS actual_revenue
        FROM jobber_api_quotes q
        JOIN jobber_api_jobs j ON j.quote_jobber_id = q.jobber_id
        GROUP BY q.jobber_id
    ) sub
    WHERE o.quote_jobber_ids @> ARRAY[sub.quote_jobber_id];

    -- Update request/assessment linkage
    UPDATE jobber_api_opportunities o
    SET
        request_jobber_id = r.jobber_id,
        assessment_date = r.assessment_start_at::DATE
    FROM jobber_api_requests r
    WHERE r.quote_jobber_ids && o.quote_jobber_ids
      AND r.assessment_start_at IS NOT NULL;

    -- Compute derived fields (first_sent_date, cycle times, buckets)
    UPDATE jobber_api_opportunities o
    SET
        -- Extract date from timestamp for computations
        first_sent_date = (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE,

        -- Days to Quote: Assessment → First SENT
        days_to_quote = CASE
            WHEN first_quote_sent_at IS NOT NULL AND assessment_date IS NOT NULL
                 AND (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE >= assessment_date
            THEN (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE - assessment_date
            ELSE NULL
        END,

        -- Speed to Quote bucket
        speed_to_quote_bucket = CASE
            WHEN first_quote_sent_at IS NULL OR assessment_date IS NULL THEN NULL
            WHEN (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE < assessment_date THEN NULL
            WHEN (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE - assessment_date = 0 THEN 'Same day'
            WHEN (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE - assessment_date <= 3 THEN '1-3 days'
            WHEN (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE - assessment_date <= 7 THEN '4-7 days'
            ELSE '8+ days'
        END,

        -- Days to Decision: First Sent → Converted
        days_to_decision = CASE
            WHEN won_date IS NOT NULL AND first_quote_sent_at IS NOT NULL
                 AND won_date >= (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE
            THEN won_date - (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE
            ELSE NULL
        END,

        -- Days to Schedule: Converted → Scheduled
        days_to_schedule = CASE
            WHEN scheduled_date IS NOT NULL AND won_date IS NOT NULL
                 AND scheduled_date >= won_date
            THEN scheduled_date - won_date
            ELSE NULL
        END,

        -- Days to Close: Scheduled → Closed
        days_to_close = CASE
            WHEN closed_date IS NOT NULL AND scheduled_date IS NOT NULL
                 AND closed_date >= scheduled_date
            THEN closed_date - scheduled_date
            ELSE NULL
        END,

        -- Total Cycle: Assessment → Closed
        total_cycle_days = CASE
            WHEN closed_date IS NOT NULL AND assessment_date IS NOT NULL
                 AND closed_date >= assessment_date
            THEN closed_date - assessment_date
            ELSE NULL
        END,

        -- Revenue bucket
        revenue_bucket = CASE
            WHEN max_quote_value < 1000 THEN '$0-$1K'
            WHEN max_quote_value < 2000 THEN '$1K-$2K'
            WHEN max_quote_value < 5000 THEN '$2K-$5K'
            WHEN max_quote_value < 10000 THEN '$5K-$10K'
            WHEN max_quote_value < 25000 THEN '$10K-$25K'
            WHEN max_quote_value < 50000 THEN '$25K-$50K'
            ELSE '$50K+'
        END,

        -- Quote count bucket
        quote_count_bucket = CASE
            WHEN quote_count = 1 THEN '1 quote'
            WHEN quote_count = 2 THEN '2 quotes'
            WHEN quote_count = 3 THEN '3 quotes'
            ELSE '4+ quotes'
        END;

    RETURN v_count;
END;
$$;

-- ============================================
-- 7. FUNNEL METRICS FUNCTION
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
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    quoted_value NUMERIC,
    total_value NUMERIC,
    value_win_rate NUMERIC,
    avg_days_to_quote NUMERIC,
    avg_days_to_decision NUMERIC,
    avg_days_to_schedule NUMERIC,
    avg_days_to_close NUMERIC,
    avg_total_cycle NUMERIC,
    same_day_quote_pct NUMERIC,
    multi_quote_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_opportunities,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT as won_opportunities,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT as lost_opportunities,
        COUNT(*) FILTER (WHERE o.is_pending)::BIGINT as pending_opportunities,
        ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1) as win_rate,
        ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100), 1) as closed_win_rate,
        COALESCE(SUM(o.won_value), 0) as won_value,
        COALESCE(SUM(o.total_quoted_value), 0) as quoted_value,
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0) as total_value,
        ROUND(
            SUM(o.won_value)::NUMERIC /
            NULLIF(SUM(
                CASE
                    WHEN o.is_won THEN o.won_value
                    ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100,
        1) as value_win_rate,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1) as avg_days_to_quote,
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1) as avg_days_to_decision,
        ROUND(AVG(o.days_to_schedule) FILTER (WHERE o.is_won)::NUMERIC, 1) as avg_days_to_schedule,
        ROUND(AVG(o.days_to_close) FILTER (WHERE o.is_won AND o.closed_date IS NOT NULL)::NUMERIC, 1) as avg_days_to_close,
        ROUND(AVG(o.total_cycle_days) FILTER (WHERE o.is_won AND o.closed_date IS NOT NULL)::NUMERIC, 1) as avg_total_cycle,
        ROUND((COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE o.speed_to_quote_bucket IS NOT NULL), 0) * 100), 1) as same_day_quote_pct,
        ROUND((COUNT(*) FILTER (WHERE o.quote_count > 1)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1) as multi_quote_pct
    FROM jobber_api_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket);
END;
$$;

-- ============================================
-- 8. SALESPERSON METRICS FUNCTION
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
    lost_opps BIGINT,
    pending_opps BIGINT,
    win_rate NUMERIC,
    closed_win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    avg_won_value NUMERIC,
    avg_days_to_quote NUMERIC,
    avg_days_to_decision NUMERIC,
    same_day_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.salesperson,
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_pending)::BIGINT,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1),
        COALESCE(SUM(o.won_value), 0)::NUMERIC,
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC,
        ROUND(COALESCE(SUM(o.won_value), 0) / NULLIF(COUNT(*) FILTER (WHERE o.is_won), 0), 0),
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1),
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1),
        ROUND((COUNT(*) FILTER (WHERE o.speed_to_quote_bucket = 'Same day')::NUMERIC /
               NULLIF(COUNT(*) FILTER (WHERE o.speed_to_quote_bucket IS NOT NULL), 0) * 100), 1)
    FROM jobber_api_opportunities o
    WHERE
        o.salesperson IS NOT NULL AND o.salesperson != ''
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.salesperson
    ORDER BY won_value DESC;
END;
$$;

-- ============================================
-- 9. SPEED TO QUOTE METRICS FUNCTION
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
    closed_win_rate NUMERIC,
    baseline_diff NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    value_win_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    baseline_rate NUMERIC;
BEGIN
    -- Calculate baseline win rate (overall)
    SELECT ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1)
    INTO baseline_rate
    FROM jobber_api_opportunities o
    WHERE o.speed_to_quote_bucket IS NOT NULL
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket);

    RETURN QUERY
    SELECT
        o.speed_to_quote_bucket::TEXT as speed_bucket,
        CASE o.speed_to_quote_bucket
            WHEN 'Same day' THEN 1
            WHEN '1-3 days' THEN 2
            WHEN '4-7 days' THEN 3
            WHEN '8+ days' THEN 4
        END as bucket_order,
        COUNT(*)::BIGINT as total_opps,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT as won_opps,
        ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1) as win_rate,
        ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100), 1) as closed_win_rate,
        ROUND((COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100) - baseline_rate, 1) as baseline_diff,
        COALESCE(SUM(o.won_value), 0) as won_value,
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0) as total_value,
        ROUND(
            SUM(o.won_value)::NUMERIC /
            NULLIF(SUM(
                CASE
                    WHEN o.is_won THEN o.won_value
                    ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100,
        1) as value_win_rate
    FROM jobber_api_opportunities o
    WHERE o.speed_to_quote_bucket IS NOT NULL
        AND (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.speed_to_quote_bucket
    ORDER BY bucket_order;
END;
$$;

-- ============================================
-- 10. PROJECT SIZE BUCKET METRICS
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_bucket_metrics(
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
    total_value NUMERIC,
    value_win_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.revenue_bucket,
        CASE o.revenue_bucket
            WHEN '$0-$1K' THEN 1 WHEN '$1K-$2K' THEN 2 WHEN '$2K-$5K' THEN 3
            WHEN '$5K-$10K' THEN 4 WHEN '$10K-$25K' THEN 5
            WHEN '$25K-$50K' THEN 6 WHEN '$50K+' THEN 7
        END,
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1),
        COALESCE(SUM(o.won_value), 0)::NUMERIC,
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC,
        ROUND(
            SUM(o.won_value)::NUMERIC /
            NULLIF(SUM(
                CASE
                    WHEN o.is_won THEN o.won_value
                    ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
                END
            ), 0) * 100,
        1)
    FROM jobber_api_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket)
    GROUP BY o.revenue_bucket
    ORDER BY bucket_order;
END;
$$;

-- ============================================
-- 11. QUOTE COUNT METRICS
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_quote_count_metrics(
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
    avg_days_to_decision NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.quote_count_bucket,
        CASE o.quote_count_bucket
            WHEN '1 quote' THEN 1 WHEN '2 quotes' THEN 2
            WHEN '3 quotes' THEN 3 WHEN '4+ quotes' THEN 4
        END,
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1),
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1)
    FROM jobber_api_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_sent_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_sent_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.quote_count_bucket
    ORDER BY bucket_order;
END;
$$;

-- ============================================
-- 12. MONTHLY TOTALS
-- ============================================

CREATE OR REPLACE FUNCTION get_api_residential_monthly_totals(
    p_months INTEGER DEFAULT 13,
    p_revenue_bucket TEXT DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL
)
RETURNS TABLE (
    month TEXT,
    month_label TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    won_value NUMERIC,
    total_value NUMERIC,
    avg_days_to_quote NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(o.first_sent_date, 'YYYY-MM'),
        TO_CHAR(o.first_sent_date, 'Mon YY'),
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
        COALESCE(SUM(o.won_value), 0)::NUMERIC,
        COALESCE(SUM(
            CASE
                WHEN o.is_won THEN o.won_value
                ELSE o.total_quoted_value / NULLIF(o.quote_count, 0)
            END
        ), 0)::NUMERIC,
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1)
    FROM jobber_api_opportunities o
    WHERE
        o.first_sent_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
    GROUP BY TO_CHAR(o.first_sent_date, 'YYYY-MM'), TO_CHAR(o.first_sent_date, 'Mon YY')
    ORDER BY month;
END;
$$;

-- ============================================
-- 13. CYCLE TIME BREAKDOWN FUNCTION
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
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- Days to Quote
    SELECT
        'Assessment → Quote Sent'::TEXT,
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
        'Quote Sent → Converted'::TEXT,
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
        'Converted → Scheduled'::TEXT,
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
        'Scheduled → Closed'::TEXT,
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
        'Total (Assessment → Closed)'::TEXT,
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
$$;

-- ============================================
-- 14. UPDATE SYNC STATUS TABLE (add requests field)
-- ============================================

ALTER TABLE jobber_sync_status
ADD COLUMN IF NOT EXISTS requests_synced INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS opportunities_computed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_full_sync_at TIMESTAMPTZ;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE jobber_api_quotes IS 'Raw quote data synced from Jobber API (Residential account)';
COMMENT ON TABLE jobber_api_jobs IS 'Raw job data synced from Jobber API (Residential account)';
COMMENT ON TABLE jobber_api_requests IS 'Raw request data synced from Jobber API (Residential account)';
COMMENT ON TABLE jobber_api_opportunities IS 'Computed opportunities with CORRECTED cycle times using sent_at';

COMMENT ON COLUMN jobber_api_opportunities.days_to_quote IS 'CORRECTED: Assessment → First SENT (not drafted)';
COMMENT ON COLUMN jobber_api_opportunities.days_to_decision IS 'First Sent → Converted (client acceptance time)';
COMMENT ON COLUMN jobber_api_opportunities.days_to_schedule IS 'Converted → Scheduled';
COMMENT ON COLUMN jobber_api_opportunities.days_to_close IS 'Scheduled → Closed (work execution time)';
COMMENT ON COLUMN jobber_api_opportunities.total_cycle_days IS 'Total cycle: Assessment → Closed';
