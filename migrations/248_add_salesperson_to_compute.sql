-- ============================================
-- UPDATE COMPUTE OPPORTUNITIES TO INCLUDE SALESPERSON
-- Migration 248: Pull salesperson from request to opportunity
-- ============================================

-- Drop and recreate with salesperson propagation
CREATE OR REPLACE FUNCTION compute_api_opportunities()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300000'  -- 5 minute timeout for this function
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Step 1: Truncate existing data
    TRUNCATE TABLE jobber_api_opportunities;

    -- Step 2: Insert opportunities aggregated from quotes (simplified, no correlated subquery)
    INSERT INTO jobber_api_opportunities (
        opportunity_key,
        client_name,
        client_name_normalized,
        service_street,
        service_street_normalized,
        service_city,
        service_state,
        service_zip,
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
        LOWER(TRIM(COALESCE(q.client_name, ''))) || '|' ||
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(q.service_street, '')), '[^a-z0-9]', '', 'gi')) AS opportunity_key,
        MAX(q.client_name) AS client_name,
        LOWER(TRIM(MAX(q.client_name))) AS client_name_normalized,
        MAX(q.service_street) AS service_street,
        LOWER(REGEXP_REPLACE(TRIM(MAX(q.service_street)), '[^a-z0-9]', '', 'gi')) AS service_street_normalized,
        MAX(q.service_city) AS service_city,
        MAX(q.service_state) AS service_state,
        MAX(q.service_zip) AS service_zip,
        COUNT(DISTINCT q.quote_number)::INTEGER AS quote_count,
        STRING_AGG(DISTINCT q.quote_number::TEXT, ', ' ORDER BY q.quote_number::TEXT) AS quote_numbers,
        ARRAY_AGG(DISTINCT q.jobber_id) AS quote_jobber_ids,
        MIN(q.sent_at) FILTER (WHERE q.sent_at IS NOT NULL) AS first_quote_sent_at,
        MAX(q.sent_at) AS last_quote_sent_at,
        MAX(q.total) AS max_quote_value,
        MIN(q.total) FILTER (WHERE q.total > 0) AS min_quote_value,
        SUM(q.total) AS total_quoted_value,
        COALESCE(SUM(q.total) FILTER (WHERE q.status = 'converted'), 0) AS won_value,
        BOOL_OR(q.status = 'converted') AS is_won,
        NOT BOOL_OR(q.status = 'converted') AND NOT BOOL_OR(q.status = 'archived') AS is_pending,
        MIN(q.converted_at::DATE) FILTER (WHERE q.status = 'converted') AS won_date,
        STRING_AGG(DISTINCT q.quote_number::TEXT, ', ') FILTER (WHERE q.status = 'converted') AS won_quote_numbers,
        NOW() AS last_computed_at
    FROM jobber_api_quotes q
    WHERE q.sent_at IS NOT NULL
    GROUP BY
        LOWER(TRIM(COALESCE(q.client_name, ''))) || '|' ||
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(q.service_street, '')), '[^a-z0-9]', '', 'gi'));

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Inserted % opportunities', v_count;

    -- Step 3: Update with job data using a CTE for efficiency
    WITH job_data AS (
        SELECT
            q.jobber_id AS quote_jobber_id,
            COUNT(DISTINCT j.job_number)::INTEGER AS job_count,
            STRING_AGG(DISTINCT j.job_number::TEXT, ', ') AS job_numbers,
            ARRAY_AGG(DISTINCT j.jobber_id) FILTER (WHERE j.jobber_id IS NOT NULL) AS job_jobber_ids,
            MIN(j.scheduled_start_at::DATE) AS scheduled_date,
            MAX(COALESCE(j.completed_at)::DATE) AS closed_date,
            SUM(j.total) AS actual_revenue
        FROM jobber_api_quotes q
        JOIN jobber_api_jobs j ON j.quote_jobber_id = q.jobber_id
        GROUP BY q.jobber_id
    )
    UPDATE jobber_api_opportunities o
    SET
        job_count = jd.job_count,
        job_numbers = jd.job_numbers,
        job_jobber_ids = jd.job_jobber_ids,
        scheduled_date = jd.scheduled_date,
        closed_date = jd.closed_date,
        actual_revenue = jd.actual_revenue
    FROM job_data jd
    WHERE o.quote_jobber_ids @> ARRAY[jd.quote_jobber_id];

    RAISE NOTICE 'Updated job linkage';

    -- Step 4: Update request/assessment linkage INCLUDING SALESPERSON
    -- Now also pulls salesperson and lead_source from request
    WITH request_data AS (
        SELECT DISTINCT ON (o.id)
            o.id AS opp_id,
            r.jobber_id AS request_id,
            r.assessment_start_at::DATE AS assessment_date,
            r.salesperson,
            r.lead_source
        FROM jobber_api_opportunities o
        JOIN jobber_api_quotes q ON q.jobber_id = ANY(o.quote_jobber_ids)
        JOIN jobber_api_requests r ON r.jobber_id = q.request_jobber_id
        WHERE r.assessment_start_at IS NOT NULL
        ORDER BY o.id, r.assessment_start_at DESC  -- Take most recent if multiple
    )
    UPDATE jobber_api_opportunities o
    SET
        request_jobber_id = rd.request_id,
        assessment_date = rd.assessment_date,
        salesperson = rd.salesperson
    FROM request_data rd
    WHERE o.id = rd.opp_id;

    RAISE NOTICE 'Updated request linkage with salesperson';

    -- Step 5: Compute derived fields
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
        END;

    RAISE NOTICE 'Computed derived fields';

    RETURN v_count;
END;
$$;

-- Grant execute to authenticated users (for RPC calls)
GRANT EXECUTE ON FUNCTION compute_api_opportunities() TO authenticated;
GRANT EXECUTE ON FUNCTION compute_api_opportunities() TO service_role;
