-- ============================================
-- RESIDENTIAL DIVISION ANALYTICS
-- Migration 235: Tables, indexes, functions, and RLS
-- ============================================

-- ============================================
-- 1. OPPORTUNITIES TABLE (Normalized - PRIMARY)
-- ============================================

CREATE TABLE IF NOT EXISTS jobber_residential_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Unique identifier (normalized client + address)
    opportunity_key TEXT NOT NULL UNIQUE,

    -- Client & Address
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
    quote_numbers TEXT,
    first_quote_date DATE,
    last_quote_date DATE,

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
    job_numbers TEXT,

    -- From Jobs (enrichment)
    scheduled_date DATE,
    closed_date DATE,
    actual_revenue DECIMAL(12,2),

    -- From Requests (for speed-to-quote)
    assessment_date DATE,

    -- Project details
    project_type TEXT,
    location TEXT,
    lead_source TEXT,

    -- Computed: Speed to Quote
    days_to_quote INTEGER GENERATED ALWAYS AS (
        CASE WHEN first_quote_date IS NOT NULL AND assessment_date IS NOT NULL
                  AND first_quote_date >= assessment_date
             THEN first_quote_date - assessment_date ELSE NULL END
    ) STORED,

    speed_to_quote_bucket TEXT GENERATED ALWAYS AS (
        CASE
            WHEN first_quote_date IS NULL OR assessment_date IS NULL THEN NULL
            WHEN first_quote_date < assessment_date THEN NULL
            WHEN first_quote_date - assessment_date = 0 THEN 'Same day'
            WHEN first_quote_date - assessment_date <= 3 THEN '1-3 days'
            WHEN first_quote_date - assessment_date <= 7 THEN '4-7 days'
            ELSE '8+ days'
        END
    ) STORED,

    -- Computed: Project Size Bucket
    revenue_bucket TEXT GENERATED ALWAYS AS (
        CASE
            WHEN max_quote_value < 1000 THEN '$0-$1K'
            WHEN max_quote_value < 2000 THEN '$1K-$2K'
            WHEN max_quote_value < 5000 THEN '$2K-$5K'
            WHEN max_quote_value < 10000 THEN '$5K-$10K'
            WHEN max_quote_value < 25000 THEN '$10K-$25K'
            WHEN max_quote_value < 50000 THEN '$25K-$50K'
            ELSE '$50K+'
        END
    ) STORED,

    -- Computed: Quote Count Bucket
    quote_count_bucket TEXT GENERATED ALWAYS AS (
        CASE
            WHEN quote_count = 1 THEN '1 quote'
            WHEN quote_count = 2 THEN '2 quotes'
            WHEN quote_count = 3 THEN '3 quotes'
            ELSE '4+ quotes'
        END
    ) STORED,

    -- Computed: Days to Close (first quote -> job closed)
    days_to_close INTEGER GENERATED ALWAYS AS (
        CASE WHEN closed_date IS NOT NULL AND first_quote_date IS NOT NULL
             THEN closed_date - first_quote_date ELSE NULL END
    ) STORED,

    -- Computed: Days to Decision (first quote -> won/converted)
    days_to_decision INTEGER GENERATED ALWAYS AS (
        CASE WHEN won_date IS NOT NULL AND first_quote_date IS NOT NULL
             THEN won_date - first_quote_date ELSE NULL END
    ) STORED,

    -- Import tracking
    first_imported_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    import_log_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for opportunities
CREATE INDEX IF NOT EXISTS idx_res_opp_key ON jobber_residential_opportunities(opportunity_key);
CREATE INDEX IF NOT EXISTS idx_res_opp_salesperson ON jobber_residential_opportunities(salesperson);
CREATE INDEX IF NOT EXISTS idx_res_opp_is_won ON jobber_residential_opportunities(is_won);
CREATE INDEX IF NOT EXISTS idx_res_opp_is_lost ON jobber_residential_opportunities(is_lost);
CREATE INDEX IF NOT EXISTS idx_res_opp_revenue_bucket ON jobber_residential_opportunities(revenue_bucket);
CREATE INDEX IF NOT EXISTS idx_res_opp_speed_bucket ON jobber_residential_opportunities(speed_to_quote_bucket);
CREATE INDEX IF NOT EXISTS idx_res_opp_quote_count_bucket ON jobber_residential_opportunities(quote_count_bucket);
CREATE INDEX IF NOT EXISTS idx_res_opp_first_quote ON jobber_residential_opportunities(first_quote_date DESC);


-- ============================================
-- 2. QUOTES TABLE (Raw)
-- ============================================

CREATE TABLE IF NOT EXISTS jobber_residential_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    quote_number INTEGER NOT NULL UNIQUE,
    opportunity_id UUID REFERENCES jobber_residential_opportunities(id),
    opportunity_key TEXT,

    -- Client
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    service_street TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,

    -- Quote details
    title TEXT,
    status TEXT,
    line_items TEXT,
    lead_source TEXT,
    project_type TEXT,
    location TEXT,

    -- People
    salesperson TEXT,
    sent_by_user TEXT,

    -- Financials
    subtotal DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    required_deposit DECIMAL(12,2) DEFAULT 0,
    collected_deposit DECIMAL(12,2) DEFAULT 0,

    -- Dates
    drafted_date DATE,
    sent_date DATE,
    approved_date DATE,
    converted_date DATE,
    archived_date DATE,

    -- Linkage
    job_numbers TEXT,

    -- Computed
    is_converted BOOLEAN GENERATED ALWAYS AS (status = 'Converted') STORED,
    is_archived BOOLEAN GENERATED ALWAYS AS (status = 'Archived') STORED,

    days_to_convert INTEGER GENERATED ALWAYS AS (
        CASE WHEN converted_date IS NOT NULL AND drafted_date IS NOT NULL
             THEN converted_date - drafted_date ELSE NULL END
    ) STORED,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_res_quote_status ON jobber_residential_quotes(status);
CREATE INDEX IF NOT EXISTS idx_res_quote_salesperson ON jobber_residential_quotes(salesperson);
CREATE INDEX IF NOT EXISTS idx_res_quote_opp_id ON jobber_residential_quotes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_res_quote_drafted ON jobber_residential_quotes(drafted_date DESC);


-- ============================================
-- 3. JOBS TABLE (For enrichment)
-- ============================================

CREATE TABLE IF NOT EXISTS jobber_residential_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_number INTEGER NOT NULL UNIQUE,
    quote_number INTEGER,

    client_name TEXT,
    service_street TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,

    title TEXT,
    project_type TEXT,
    salesperson TEXT,
    location TEXT,

    -- Dates
    created_date DATE,
    scheduled_start_date DATE,
    closed_date DATE,

    -- Financials
    total_revenue DECIMAL(12,2) DEFAULT 0,
    total_costs DECIMAL(12,2) DEFAULT 0,
    profit DECIMAL(12,2) DEFAULT 0,

    -- Crew
    crew_1 TEXT,
    crew_1_pay DECIMAL(10,2) DEFAULT 0,
    crew_2 TEXT,
    crew_2_pay DECIMAL(10,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_res_job_number ON jobber_residential_jobs(job_number);
CREATE INDEX IF NOT EXISTS idx_res_job_quote ON jobber_residential_jobs(quote_number);


-- ============================================
-- 4. AGGREGATION FUNCTIONS
-- ============================================

-- Main funnel metrics with all filters
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
    value_win_rate NUMERIC,
    avg_days_to_quote NUMERIC,
    avg_days_to_decision NUMERIC,
    avg_days_to_close NUMERIC
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
        ROUND(COALESCE(SUM(o.won_value), 0) / NULLIF(SUM(o.max_quote_value), 0) * 100, 1),
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1),
        ROUND(AVG(o.days_to_decision) FILTER (WHERE o.is_won)::NUMERIC, 1),
        ROUND(AVG(o.days_to_close) FILTER (WHERE o.is_won)::NUMERIC, 1)
    FROM jobber_residential_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
        AND (p_speed_bucket IS NULL OR o.speed_to_quote_bucket = p_speed_bucket);
END;
$$ LANGUAGE plpgsql;


-- Salesperson metrics with project size filter
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
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_lost)::BIGINT,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1),
        COALESCE(SUM(o.won_value), 0)::NUMERIC,
        ROUND(COALESCE(SUM(o.won_value), 0) / NULLIF(COUNT(*) FILTER (WHERE o.is_won), 0), 0),
        ROUND(AVG(o.days_to_quote)::NUMERIC, 1)
    FROM jobber_residential_opportunities o
    WHERE
        o.salesperson IS NOT NULL AND o.salesperson != ''
        AND (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.salesperson
    ORDER BY won_value DESC;
END;
$$ LANGUAGE plpgsql;


-- Project size metrics
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
    won_value NUMERIC
) AS $$
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
        COALESCE(SUM(o.won_value), 0)::NUMERIC
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


-- Speed to quote metrics
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
    baseline_diff NUMERIC
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
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) - v_baseline_rate
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


-- Speed x Size cross-tab
CREATE OR REPLACE FUNCTION get_residential_speed_by_size_matrix(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_salesperson TEXT DEFAULT NULL
)
RETURNS TABLE (
    speed_bucket TEXT,
    revenue_bucket TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.speed_to_quote_bucket,
        o.revenue_bucket,
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1)
    FROM jobber_residential_opportunities o
    WHERE
        o.speed_to_quote_bucket IS NOT NULL
        AND (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_salesperson IS NULL OR o.salesperson = p_salesperson)
    GROUP BY o.speed_to_quote_bucket, o.revenue_bucket
    ORDER BY
        CASE o.speed_to_quote_bucket
            WHEN 'Same day' THEN 1 WHEN '1-3 days' THEN 2
            WHEN '4-7 days' THEN 3 WHEN '8+ days' THEN 4
        END,
        CASE o.revenue_bucket
            WHEN '$0-$1K' THEN 1 WHEN '$1K-$2K' THEN 2 WHEN '$2K-$5K' THEN 3
            WHEN '$5K-$10K' THEN 4 WHEN '$10K-$25K' THEN 5
            WHEN '$25K-$50K' THEN 6 WHEN '$50K+' THEN 7
        END;
END;
$$ LANGUAGE plpgsql;


-- Quote count metrics
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
    closed_win_rate NUMERIC
) AS $$
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
              NULLIF(COUNT(*) FILTER (WHERE o.is_won OR o.is_lost), 0) * 100, 1)
    FROM jobber_residential_opportunities o
    WHERE
        (p_start_date IS NULL OR o.first_quote_date >= p_start_date)
        AND (p_end_date IS NULL OR o.first_quote_date <= p_end_date)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.quote_count_bucket
    ORDER BY bucket_order;
END;
$$ LANGUAGE plpgsql;


-- Monthly trend by salesperson with project size filter
CREATE OR REPLACE FUNCTION get_residential_salesperson_monthly(
    p_months INTEGER DEFAULT 12,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    salesperson TEXT,
    month TEXT,
    month_label TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    won_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.salesperson,
        TO_CHAR(o.first_quote_date, 'YYYY-MM'),
        TO_CHAR(o.first_quote_date, 'Mon YY'),
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
        COALESCE(SUM(o.won_value), 0)::NUMERIC
    FROM jobber_residential_opportunities o
    WHERE
        o.first_quote_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
        AND o.salesperson IS NOT NULL AND o.salesperson != ''
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY o.salesperson, TO_CHAR(o.first_quote_date, 'YYYY-MM'), TO_CHAR(o.first_quote_date, 'Mon YY')
    ORDER BY o.salesperson, month;
END;
$$ LANGUAGE plpgsql;


-- Monthly totals
CREATE OR REPLACE FUNCTION get_residential_monthly_totals(
    p_months INTEGER DEFAULT 12,
    p_revenue_bucket TEXT DEFAULT NULL
)
RETURNS TABLE (
    month TEXT,
    month_label TEXT,
    total_opps BIGINT,
    won_opps BIGINT,
    win_rate NUMERIC,
    won_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(o.first_quote_date, 'YYYY-MM'),
        TO_CHAR(o.first_quote_date, 'Mon YY'),
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE o.is_won)::BIGINT,
        ROUND(COUNT(*) FILTER (WHERE o.is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
        COALESCE(SUM(o.won_value), 0)::NUMERIC
    FROM jobber_residential_opportunities o
    WHERE
        o.first_quote_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
        AND (p_revenue_bucket IS NULL OR o.revenue_bucket = p_revenue_bucket)
    GROUP BY TO_CHAR(o.first_quote_date, 'YYYY-MM'), TO_CHAR(o.first_quote_date, 'Mon YY')
    ORDER BY month;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE jobber_residential_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobber_residential_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobber_residential_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "residential_opp_authenticated_access" ON jobber_residential_opportunities
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "residential_quote_authenticated_access" ON jobber_residential_quotes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "residential_job_authenticated_access" ON jobber_residential_jobs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================
-- 6. UPDATE IMPORT LOGS TABLE (if needed)
-- ============================================

-- Add 'residential' as a valid business_unit if not already supported
-- The jobber_import_logs table should already exist from builder analytics
-- Just ensure it can handle residential imports

-- Optional: Add import log entry type for residential
-- ALTER TYPE business_unit_type ADD VALUE IF NOT EXISTS 'residential';


-- ============================================
-- VERIFICATION QUERIES (commented out)
-- ============================================
/*
-- After import, verify:

-- Total opportunities (should be ~7,759)
SELECT COUNT(*) FROM jobber_residential_opportunities;

-- Win rate (should be ~35.5%)
SELECT * FROM get_residential_funnel_metrics();

-- Speed to quote impact
SELECT * FROM get_residential_speed_metrics();

-- Size breakdown
SELECT * FROM get_residential_bucket_metrics();
*/
