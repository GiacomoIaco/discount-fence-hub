-- ============================================
-- JOBBER IMPORT HUB - DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Import Logs Table
CREATE TABLE IF NOT EXISTS jobber_import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit TEXT NOT NULL CHECK (business_unit IN ('builder', 'residential')),
    report_type TEXT NOT NULL CHECK (report_type IN ('jobs', 'quotes', 'invoices')),
    file_name TEXT NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    
    total_rows INTEGER NOT NULL DEFAULT 0,
    new_records INTEGER NOT NULL DEFAULT 0,
    updated_records INTEGER NOT NULL DEFAULT 0,
    skipped_records INTEGER NOT NULL DEFAULT 0,
    errors JSONB DEFAULT '[]',
    
    data_start_date DATE,
    data_end_date DATE,
    
    status TEXT NOT NULL DEFAULT 'processing' 
        CHECK (status IN ('processing', 'completed', 'failed')),
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_import_logs_bu_date ON jobber_import_logs(business_unit, uploaded_at DESC);

-- 2. Name Normalization Table
CREATE TABLE IF NOT EXISTS jobber_name_normalization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_name TEXT NOT NULL UNIQUE,
    canonical_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed name normalization data
INSERT INTO jobber_name_normalization (original_name, canonical_name) VALUES
('YAMIL', 'Yamil Hernandez'),
('Yamil', 'Yamil Hernandez'),
('EDWARD SAMARIPA', 'Edward Samaripa'),
('DANNY STORY', 'Danny Story'),
('HECTOR SANDOVAL', 'Hector Sandoval'),
('JASON CASTRO', 'Jason Castro'),
('SEAN HOOD', 'Sean Hood'),
('BRIAN OJEDA', 'Brian Ojeda'),
('JORGE MORALES', 'Jorge Morales'),
('JASON COLEMAN', 'Jason Coleman'),
('ANDREW LUCIO', 'Andrew Lucio'),
('HENRY', 'Henry'),
('PATRICK', 'Patrick')
ON CONFLICT (original_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_name_norm_original ON jobber_name_normalization(original_name);

-- 3. Builder Jobs Table
CREATE TABLE IF NOT EXISTS jobber_builder_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifiers
    job_number INTEGER NOT NULL UNIQUE,
    quote_number INTEGER,
    invoice_numbers TEXT,
    
    -- Client
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    billing_street TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip TEXT,
    service_street TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,
    
    -- Job details
    title TEXT,
    line_items TEXT,
    project_type TEXT,
    standard_product TEXT,
    standard_product_2 TEXT,
    
    -- People (raw)
    salesperson_raw TEXT,
    builder_rep_raw TEXT,
    visits_assigned_to TEXT,
    
    -- Normalized
    effective_salesperson TEXT,
    
    -- Builder-specific
    community TEXT,
    super_name TEXT,
    super_email TEXT,
    po_number TEXT,
    pricing_tier TEXT,
    franchise_location TEXT,
    
    -- Dates
    created_date DATE,
    scheduled_start_date DATE,
    closed_date DATE,
    
    -- Financials
    total_revenue DECIMAL(12,2) DEFAULT 0,
    total_costs DECIMAL(12,2) DEFAULT 0,
    profit DECIMAL(12,2) DEFAULT 0,
    profit_percent DECIMAL(5,2) DEFAULT 0,
    quote_discount DECIMAL(12,2) DEFAULT 0,
    po_budget DECIMAL(12,2) DEFAULT 0,
    procurement_material_estimate DECIMAL(12,2) DEFAULT 0,
    procurement_labor_estimate DECIMAL(12,2) DEFAULT 0,
    
    -- Crew
    crew_1 TEXT,
    crew_1_pay DECIMAL(10,2) DEFAULT 0,
    crew_2 TEXT,
    crew_2_pay DECIMAL(10,2) DEFAULT 0,
    crew_3 TEXT,
    crew_3_pay DECIMAL(10,2) DEFAULT 0,
    
    -- Rock fees
    job_contains_rock_fee TEXT,
    rock_fee_required TEXT,
    pay_crew_rock_fee TEXT,
    
    -- Other
    overage_ft DECIMAL(10,2) DEFAULT 0,
    gps_coordinates TEXT,
    details_811 TEXT,
    on_qbo TEXT,
    
    -- Computed
    is_warranty BOOLEAN GENERATED ALWAYS AS (
        project_type ILIKE '%warranty%' OR total_revenue = 0
    ) STORED,
    is_substantial BOOLEAN GENERATED ALWAYS AS (
        total_revenue > 300
    ) STORED,
    days_to_schedule INTEGER GENERATED ALWAYS AS (
        CASE WHEN scheduled_start_date IS NOT NULL AND created_date IS NOT NULL 
             THEN scheduled_start_date - created_date ELSE NULL END
    ) STORED,
    days_to_close INTEGER GENERATED ALWAYS AS (
        CASE WHEN closed_date IS NOT NULL AND scheduled_start_date IS NOT NULL 
             THEN closed_date - scheduled_start_date ELSE NULL END
    ) STORED,
    total_cycle_days INTEGER GENERATED ALWAYS AS (
        CASE WHEN closed_date IS NOT NULL AND created_date IS NOT NULL 
             THEN closed_date - created_date ELSE NULL END
    ) STORED,
    
    -- Import tracking
    first_imported_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    import_log_id UUID REFERENCES jobber_import_logs(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_effective_sp ON jobber_builder_jobs(effective_salesperson);
CREATE INDEX IF NOT EXISTS idx_jobs_created_date ON jobber_builder_jobs(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_closed_date ON jobber_builder_jobs(closed_date DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_project_type ON jobber_builder_jobs(project_type);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobber_builder_jobs(client_name);
CREATE INDEX IF NOT EXISTS idx_jobs_community ON jobber_builder_jobs(community);
CREATE INDEX IF NOT EXISTS idx_jobs_franchise ON jobber_builder_jobs(franchise_location);
CREATE INDEX IF NOT EXISTS idx_jobs_substantial ON jobber_builder_jobs(is_substantial) WHERE is_substantial = true;

-- 4. Builder Quotes Table
CREATE TABLE IF NOT EXISTS jobber_builder_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifiers
    quote_number INTEGER NOT NULL UNIQUE,
    job_numbers TEXT,
    
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
    
    -- People
    salesperson_raw TEXT,
    builder_rep_raw TEXT,
    effective_salesperson TEXT,
    sent_by_user TEXT,
    
    -- Financials
    subtotal DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    required_deposit DECIMAL(12,2) DEFAULT 0,
    collected_deposit DECIMAL(12,2) DEFAULT 0,
    
    -- Builder-specific
    community TEXT,
    super_name TEXT,
    super_email TEXT,
    po_number TEXT,
    po_budget DECIMAL(12,2) DEFAULT 0,
    pricing_tier TEXT,
    franchise_location TEXT,
    project_type TEXT,
    standard_product TEXT,
    
    -- Dates
    drafted_date DATE,
    sent_date DATE,
    changes_requested_date DATE,
    approved_date DATE,
    converted_date DATE,
    archived_date DATE,
    
    -- Computed
    is_converted BOOLEAN GENERATED ALWAYS AS (status = 'Converted') STORED,
    days_to_convert INTEGER GENERATED ALWAYS AS (
        CASE WHEN converted_date IS NOT NULL AND drafted_date IS NOT NULL 
             THEN converted_date - drafted_date ELSE NULL END
    ) STORED,
    
    -- Import tracking
    first_imported_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    import_log_id UUID REFERENCES jobber_import_logs(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotes indexes
CREATE INDEX IF NOT EXISTS idx_quotes_status ON jobber_builder_quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_effective_sp ON jobber_builder_quotes(effective_salesperson);
CREATE INDEX IF NOT EXISTS idx_quotes_drafted ON jobber_builder_quotes(drafted_date DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_client ON jobber_builder_quotes(client_name);

-- 5. Builder Invoices Table
CREATE TABLE IF NOT EXISTS jobber_builder_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifiers
    invoice_number INTEGER NOT NULL UNIQUE,
    job_numbers TEXT,
    
    -- Client
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    billing_street TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip TEXT,
    service_street TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,
    
    -- Invoice details
    subject TEXT,
    status TEXT,
    line_items TEXT,
    
    -- People
    salesperson_raw TEXT,
    builder_rep_raw TEXT,
    effective_salesperson TEXT,
    visits_assigned_to TEXT,
    
    -- Financials
    pre_tax_total DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    tip DECIMAL(12,2) DEFAULT 0,
    balance DECIMAL(12,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    deposit DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    
    -- Builder-specific
    community TEXT,
    super_name TEXT,
    super_email TEXT,
    po_number TEXT,
    po_budget DECIMAL(12,2) DEFAULT 0,
    pricing_tier TEXT,
    franchise_location TEXT,
    project_type TEXT,
    standard_product TEXT,
    
    -- Crew
    crew_1 TEXT,
    crew_1_pay DECIMAL(10,2) DEFAULT 0,
    crew_2 TEXT,
    crew_2_pay DECIMAL(10,2) DEFAULT 0,
    crew_3 TEXT,
    crew_3_pay DECIMAL(10,2) DEFAULT 0,
    
    -- Dates
    created_date DATE,
    issued_date DATE,
    due_date DATE,
    marked_paid_date DATE,
    last_contacted DATE,
    
    -- Timing
    late_by_days INTEGER,
    days_to_paid INTEGER,
    
    -- Computed
    is_paid BOOLEAN GENERATED ALWAYS AS (
        status = 'Paid' OR marked_paid_date IS NOT NULL
    ) STORED,
    is_overdue BOOLEAN GENERATED ALWAYS AS (
        balance > 0 AND status = 'Past Due'
    ) STORED,
    
    -- Import tracking
    first_imported_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    import_log_id UUID REFERENCES jobber_import_logs(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_status ON jobber_builder_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_effective_sp ON jobber_builder_invoices(effective_salesperson);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON jobber_builder_invoices(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON jobber_builder_invoices(client_name);
CREATE INDEX IF NOT EXISTS idx_invoices_balance ON jobber_builder_invoices(balance) WHERE balance > 0;

-- ============================================
-- AGGREGATION FUNCTIONS
-- ============================================

-- Function: Get salesperson metrics
CREATE OR REPLACE FUNCTION get_builder_salesperson_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_franchise_location TEXT DEFAULT NULL
)
RETURNS TABLE (
    name TEXT,
    total_jobs BIGINT,
    substantial_jobs BIGINT,
    warranty_jobs BIGINT,
    total_revenue NUMERIC,
    avg_job_value NUMERIC,
    avg_days_to_schedule NUMERIC,
    avg_days_to_close NUMERIC,
    avg_total_days NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.effective_salesperson AS name,
        COUNT(*)::BIGINT AS total_jobs,
        COUNT(*) FILTER (WHERE j.is_substantial)::BIGINT AS substantial_jobs,
        COUNT(*) FILTER (WHERE j.is_warranty)::BIGINT AS warranty_jobs,
        COALESCE(SUM(j.total_revenue), 0)::NUMERIC AS total_revenue,
        CASE 
            WHEN COUNT(*) FILTER (WHERE j.is_substantial) > 0 
            THEN ROUND(SUM(j.total_revenue) / COUNT(*) FILTER (WHERE j.is_substantial), 0)
            ELSE 0 
        END AS avg_job_value,
        ROUND(AVG(j.days_to_schedule) FILTER (WHERE j.days_to_schedule >= 0), 1) AS avg_days_to_schedule,
        ROUND(AVG(j.days_to_close) FILTER (WHERE j.days_to_close IS NOT NULL AND j.days_to_close >= 0), 1) AS avg_days_to_close,
        ROUND(AVG(j.total_cycle_days) FILTER (WHERE j.total_cycle_days >= 0), 1) AS avg_total_days
    FROM jobber_builder_jobs j
    WHERE 
        j.effective_salesperson IS NOT NULL 
        AND j.effective_salesperson != ''
        AND j.effective_salesperson != '(Unassigned)'
        AND (p_start_date IS NULL OR j.created_date >= p_start_date)
        AND (p_end_date IS NULL OR j.created_date <= p_end_date)
        AND (p_franchise_location IS NULL OR j.franchise_location = p_franchise_location)
    GROUP BY j.effective_salesperson
    ORDER BY total_revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Get monthly trend
CREATE OR REPLACE FUNCTION get_builder_monthly_trend(
    p_months INTEGER DEFAULT 12,
    p_salesperson TEXT DEFAULT NULL,
    p_franchise_location TEXT DEFAULT NULL
)
RETURNS TABLE (
    month TEXT,
    label TEXT,
    total_jobs BIGINT,
    substantial_jobs BIGINT,
    warranty_jobs BIGINT,
    revenue NUMERIC,
    avg_job_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TO_CHAR(j.created_date, 'YYYY-MM') AS month,
        TO_CHAR(j.created_date, 'Mon YY') AS label,
        COUNT(*)::BIGINT AS total_jobs,
        COUNT(*) FILTER (WHERE j.is_substantial)::BIGINT AS substantial_jobs,
        COUNT(*) FILTER (WHERE j.is_warranty)::BIGINT AS warranty_jobs,
        COALESCE(SUM(j.total_revenue), 0)::NUMERIC AS revenue,
        CASE 
            WHEN COUNT(*) FILTER (WHERE j.is_substantial) > 0 
            THEN ROUND(SUM(j.total_revenue) / COUNT(*) FILTER (WHERE j.is_substantial), 0)
            ELSE 0 
        END AS avg_job_value
    FROM jobber_builder_jobs j
    WHERE 
        j.created_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
        AND (p_salesperson IS NULL OR j.effective_salesperson = p_salesperson)
        AND (p_franchise_location IS NULL OR j.franchise_location = p_franchise_location)
    GROUP BY TO_CHAR(j.created_date, 'YYYY-MM'), TO_CHAR(j.created_date, 'Mon YY')
    ORDER BY month;
END;
$$ LANGUAGE plpgsql;

-- Function: Get client metrics
CREATE OR REPLACE FUNCTION get_builder_client_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    client_name TEXT,
    total_jobs BIGINT,
    total_quotes BIGINT,
    total_invoices BIGINT,
    total_revenue NUMERIC,
    avg_job_value NUMERIC,
    warranty_jobs BIGINT,
    avg_cycle_days NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.client_name,
        COUNT(DISTINCT j.job_number)::BIGINT AS total_jobs,
        COUNT(DISTINCT q.quote_number)::BIGINT AS total_quotes,
        COUNT(DISTINCT i.invoice_number)::BIGINT AS total_invoices,
        COALESCE(SUM(DISTINCT j.total_revenue), 0)::NUMERIC AS total_revenue,
        CASE 
            WHEN COUNT(DISTINCT j.job_number) FILTER (WHERE j.is_substantial) > 0 
            THEN ROUND(SUM(DISTINCT j.total_revenue) / COUNT(DISTINCT j.job_number) FILTER (WHERE j.is_substantial), 0)
            ELSE 0 
        END AS avg_job_value,
        COUNT(DISTINCT j.job_number) FILTER (WHERE j.is_warranty)::BIGINT AS warranty_jobs,
        ROUND(AVG(j.total_cycle_days) FILTER (WHERE j.total_cycle_days >= 0), 1) AS avg_cycle_days
    FROM jobber_builder_jobs j
    LEFT JOIN jobber_builder_quotes q ON q.client_name = j.client_name
    LEFT JOIN jobber_builder_invoices i ON i.client_name = j.client_name
    WHERE 
        j.client_name IS NOT NULL 
        AND j.client_name != ''
        AND (p_start_date IS NULL OR j.created_date >= p_start_date)
        AND (p_end_date IS NULL OR j.created_date <= p_end_date)
    GROUP BY j.client_name
    ORDER BY total_revenue DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Get pipeline summary
CREATE OR REPLACE FUNCTION get_builder_pipeline_summary()
RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC,
    record_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    
    -- Jobs metrics
    SELECT 'total_job_revenue'::TEXT, SUM(total_revenue)::NUMERIC, COUNT(*)::BIGINT
    FROM jobber_builder_jobs
    
    UNION ALL
    
    SELECT 'open_pipeline'::TEXT, SUM(total_revenue)::NUMERIC, COUNT(*)::BIGINT
    FROM jobber_builder_jobs WHERE closed_date IS NULL
    
    UNION ALL
    
    -- Quote metrics
    SELECT 'total_quote_value'::TEXT, SUM(total)::NUMERIC, COUNT(*)::BIGINT
    FROM jobber_builder_quotes
    
    UNION ALL
    
    SELECT 'draft_quotes'::TEXT, SUM(total)::NUMERIC, COUNT(*)::BIGINT
    FROM jobber_builder_quotes WHERE status = 'Draft'
    
    UNION ALL
    
    SELECT 'awaiting_response'::TEXT, SUM(total)::NUMERIC, COUNT(*)::BIGINT
    FROM jobber_builder_quotes WHERE status = 'Awaiting response'
    
    UNION ALL
    
    SELECT 'converted_quotes'::TEXT, SUM(total)::NUMERIC, COUNT(*)::BIGINT
    FROM jobber_builder_quotes WHERE status = 'Converted'
    
    UNION ALL
    
    -- Invoice metrics
    SELECT 'total_invoiced'::TEXT, SUM(total)::NUMERIC, COUNT(*)::BIGINT
    FROM jobber_builder_invoices
    
    UNION ALL
    
    SELECT 'outstanding_balance'::TEXT, SUM(balance)::NUMERIC, COUNT(*) FILTER (WHERE balance > 0)::BIGINT
    FROM jobber_builder_invoices;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_jobber_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jobber_jobs_updated ON jobber_builder_jobs;
CREATE TRIGGER jobber_jobs_updated
    BEFORE UPDATE ON jobber_builder_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_jobber_timestamp();

DROP TRIGGER IF EXISTS jobber_quotes_updated ON jobber_builder_quotes;
CREATE TRIGGER jobber_quotes_updated
    BEFORE UPDATE ON jobber_builder_quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_jobber_timestamp();

DROP TRIGGER IF EXISTS jobber_invoices_updated ON jobber_builder_invoices;
CREATE TRIGGER jobber_invoices_updated
    BEFORE UPDATE ON jobber_builder_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_jobber_timestamp();

-- ============================================
-- ROW LEVEL SECURITY (Optional)
-- ============================================

-- Enable RLS on tables
ALTER TABLE jobber_import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobber_builder_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobber_builder_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobber_builder_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobber_name_normalization ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Allow authenticated read" ON jobber_import_logs
    FOR SELECT TO authenticated USING (true);
    
CREATE POLICY "Allow authenticated read" ON jobber_builder_jobs
    FOR SELECT TO authenticated USING (true);
    
CREATE POLICY "Allow authenticated read" ON jobber_builder_quotes
    FOR SELECT TO authenticated USING (true);
    
CREATE POLICY "Allow authenticated read" ON jobber_builder_invoices
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON jobber_name_normalization
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert/update (for imports)
CREATE POLICY "Allow authenticated insert" ON jobber_import_logs
    FOR INSERT TO authenticated WITH CHECK (true);
    
CREATE POLICY "Allow authenticated update" ON jobber_import_logs
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON jobber_builder_jobs
    FOR INSERT TO authenticated WITH CHECK (true);
    
CREATE POLICY "Allow authenticated update" ON jobber_builder_jobs
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON jobber_builder_quotes
    FOR INSERT TO authenticated WITH CHECK (true);
    
CREATE POLICY "Allow authenticated update" ON jobber_builder_quotes
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON jobber_builder_invoices
    FOR INSERT TO authenticated WITH CHECK (true);
    
CREATE POLICY "Allow authenticated update" ON jobber_builder_invoices
    FOR UPDATE TO authenticated USING (true);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these after import to verify data:
/*
SELECT 'Import Logs' as table_name, COUNT(*) as count FROM jobber_import_logs
UNION ALL
SELECT 'Jobs', COUNT(*) FROM jobber_builder_jobs
UNION ALL
SELECT 'Quotes', COUNT(*) FROM jobber_builder_quotes
UNION ALL
SELECT 'Invoices', COUNT(*) FROM jobber_builder_invoices
UNION ALL
SELECT 'Name Mappings', COUNT(*) FROM jobber_name_normalization;

-- Test salesperson metrics
SELECT * FROM get_builder_salesperson_metrics() LIMIT 10;

-- Test monthly trend
SELECT * FROM get_builder_monthly_trend(12);

-- Test pipeline summary
SELECT * FROM get_builder_pipeline_summary();
*/
