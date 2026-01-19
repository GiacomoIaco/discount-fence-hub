-- ============================================
-- Migration 265: Fix is_lost Logic in API Opportunities
-- ============================================
--
-- PROBLEM: The compute_api_opportunities() function never sets is_lost,
-- causing it to default to FALSE for ALL opportunities.
-- This breaks closed_win_rate calculation:
--   closed_win_rate = won / (won + lost) = won / won = 100%
--
-- FIX: Add is_lost calculation:
--   is_lost = TRUE when ALL quotes are archived AND none are converted
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
        -- is_won: at least one quote was converted
        BOOL_OR(q.status = 'converted') AS is_won,

        -- is_lost: at least one quote is archived AND no quotes are converted
        -- (i.e., the opportunity was explicitly closed without winning)
        BOOL_OR(q.status = 'archived') AND NOT BOOL_OR(q.status = 'converted') AS is_lost,

        -- is_pending: not won AND not lost (still active opportunity)
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

        -- Days to Quote: Assessment -> First SENT
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

        -- Days to Decision: First Sent -> Converted
        days_to_decision = CASE
            WHEN won_date IS NOT NULL AND first_quote_sent_at IS NOT NULL
                 AND won_date >= (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE
            THEN won_date - (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE
            ELSE NULL
        END,

        -- Days to Schedule: Converted -> Scheduled
        days_to_schedule = CASE
            WHEN scheduled_date IS NOT NULL AND won_date IS NOT NULL
                 AND scheduled_date >= won_date
            THEN scheduled_date - won_date
            ELSE NULL
        END,

        -- Days to Close: Scheduled -> Closed
        days_to_close = CASE
            WHEN closed_date IS NOT NULL AND scheduled_date IS NOT NULL
                 AND closed_date >= scheduled_date
            THEN closed_date - scheduled_date
            ELSE NULL
        END,

        -- Total Cycle: Assessment -> Closed
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
-- Recompute opportunities to apply the fix
-- ============================================
SELECT compute_api_opportunities();

-- ============================================
-- Verify the fix
-- ============================================
-- Show counts by status
SELECT
    COUNT(*) FILTER (WHERE is_won) AS won_count,
    COUNT(*) FILTER (WHERE is_lost) AS lost_count,
    COUNT(*) FILTER (WHERE is_pending) AS pending_count,
    COUNT(*) AS total_count,
    ROUND(COUNT(*) FILTER (WHERE is_won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS overall_win_rate,
    ROUND(COUNT(*) FILTER (WHERE is_won)::NUMERIC /
          NULLIF(COUNT(*) FILTER (WHERE is_won OR is_lost), 0) * 100, 1) AS closed_win_rate
FROM jobber_api_opportunities;
