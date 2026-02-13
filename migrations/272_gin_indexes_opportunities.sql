-- ============================================
-- Migration 272: Add GIN indexes for array containment/overlap queries
-- ============================================
-- compute_api_opportunities() times out because the job linkage UPDATE
-- uses @> (array contains) and the request linkage uses && (array overlap)
-- on quote_jobber_ids columns with NO indexes.
-- With 7.5K opportunities x 4.3K jobs x 10.7K requests, these are
-- tens of millions of sequential comparisons.
-- GIN indexes make array operators use index scans instead.

-- GIN index for: WHERE o.quote_jobber_ids @> ARRAY[sub.quote_jobber_id]
CREATE INDEX IF NOT EXISTS idx_api_opp_quote_jobber_ids_gin
ON jobber_api_opportunities USING GIN (quote_jobber_ids);

-- GIN index for: WHERE r.quote_jobber_ids && o.quote_jobber_ids
CREATE INDEX IF NOT EXISTS idx_api_req_quote_jobber_ids_gin
ON jobber_api_requests USING GIN (quote_jobber_ids);

-- Also update the function to set a longer statement timeout
-- (the default 8s Supabase timeout is too tight for a full recompute)
CREATE OR REPLACE FUNCTION compute_api_opportunities()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
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
        is_lost,
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

        -- Status flags
        BOOL_OR(q.status = 'converted') AS is_won,
        BOOL_OR(q.status = 'archived') AND NOT BOOL_OR(q.status = 'converted') AS is_lost,
        NOT BOOL_OR(q.status = 'converted') AND NOT BOOL_OR(q.status = 'archived') AS is_pending,

        -- Won date (earliest converted_at)
        MIN(q.converted_at::DATE) FILTER (WHERE q.status = 'converted') AS won_date,
        STRING_AGG(DISTINCT q.quote_number::TEXT, ', ') FILTER (WHERE q.status = 'converted') AS won_quote_numbers,

        NOW() AS last_computed_at
    FROM jobber_api_quotes q
    WHERE q.sent_at IS NOT NULL
    GROUP BY
        LOWER(TRIM(COALESCE(q.client_name, ''))) || '|' ||
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(q.service_street, '')), '[^a-z0-9]', '', 'gi'));

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Update job linkage (GIN index on quote_jobber_ids makes @> fast)
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

    -- Update request/assessment linkage (GIN index makes && fast)
    UPDATE jobber_api_opportunities o
    SET
        request_jobber_id = r.jobber_id,
        assessment_date = r.assessment_start_at::DATE
    FROM jobber_api_requests r
    WHERE r.quote_jobber_ids && o.quote_jobber_ids
      AND r.assessment_start_at IS NOT NULL;

    -- Compute derived fields
    UPDATE jobber_api_opportunities o
    SET
        first_sent_date = (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE,

        days_to_quote = CASE
            WHEN first_quote_sent_at IS NOT NULL AND assessment_date IS NOT NULL
                 AND (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE >= assessment_date
            THEN (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE - assessment_date
            ELSE NULL
        END,

        speed_to_quote_bucket = CASE
            WHEN first_quote_sent_at IS NULL OR assessment_date IS NULL THEN NULL
            WHEN (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE < assessment_date THEN NULL
            WHEN (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE - assessment_date = 0 THEN 'Same day'
            WHEN (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE - assessment_date <= 3 THEN '1-3 days'
            WHEN (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE - assessment_date <= 7 THEN '4-7 days'
            ELSE '8+ days'
        END,

        days_to_decision = CASE
            WHEN won_date IS NOT NULL AND first_quote_sent_at IS NOT NULL
                 AND won_date >= (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE
            THEN won_date - (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE
            ELSE NULL
        END,

        days_to_schedule = CASE
            WHEN scheduled_date IS NOT NULL AND won_date IS NOT NULL
                 AND scheduled_date >= won_date
            THEN scheduled_date - won_date
            ELSE NULL
        END,

        days_to_close = CASE
            WHEN closed_date IS NOT NULL AND scheduled_date IS NOT NULL
                 AND closed_date >= scheduled_date
            THEN closed_date - scheduled_date
            ELSE NULL
        END,

        total_cycle_days = CASE
            WHEN closed_date IS NOT NULL AND assessment_date IS NOT NULL
                 AND closed_date >= assessment_date
            THEN closed_date - assessment_date
            ELSE NULL
        END,

        revenue_bucket = CASE
            WHEN max_quote_value < 1000 THEN '$0-$1K'
            WHEN max_quote_value < 2000 THEN '$1K-$2K'
            WHEN max_quote_value < 5000 THEN '$2K-$5K'
            WHEN max_quote_value < 10000 THEN '$5K-$10K'
            WHEN max_quote_value < 25000 THEN '$10K-$25K'
            WHEN max_quote_value < 50000 THEN '$25K-$50K'
            ELSE '$50K+'
        END,

        quote_count_bucket = CASE
            WHEN quote_count = 1 THEN '1 quote'
            WHEN quote_count = 2 THEN '2 quotes'
            WHEN quote_count = 3 THEN '3 quotes'
            ELSE '4+ quotes'
        END
    WHERE o.id IS NOT NULL;

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_api_opportunities() TO authenticated;
GRANT EXECUTE ON FUNCTION compute_api_opportunities() TO service_role;
