-- ============================================
-- Migration 274: Incremental opportunity recomputation
-- ============================================
-- Instead of TRUNCATE + rebuild all 8K+ opportunities every sync,
-- only recompute opportunities affected by recently synced data.
-- Sync window is 100 days, plus 28-day grouping buffer = 128 days.
-- This cuts compute from ~10K quotes -> ~1.8K quotes (~5x faster).

CREATE OR REPLACE FUNCTION compute_api_opportunities()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
DECLARE
    v_count INTEGER := 0;
    v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '128 days';
BEGIN
    -- Step 1: Delete only opportunities that overlap the sync window.
    -- We match on client+street (not opportunity_key which includes group_num)
    -- because the grouping might change when new quotes arrive.
    DELETE FROM jobber_api_opportunities o
    USING (
        SELECT DISTINCT
            LOWER(TRIM(COALESCE(client_name, ''))) AS cn,
            LOWER(REGEXP_REPLACE(TRIM(COALESCE(service_street, '')), '[^a-z0-9]', '', 'gi')) AS ss
        FROM jobber_api_quotes
        WHERE sent_at >= v_cutoff
    ) affected
    WHERE o.client_name_normalized = affected.cn
      AND o.service_street_normalized = affected.ss;

    -- Step 2: Recompute only affected client+street combos.
    -- Uses ALL quotes for those combos (not just recent) for correct windowing.
    WITH affected_keys AS (
        SELECT DISTINCT
            LOWER(TRIM(COALESCE(client_name, ''))) || '|' ||
            LOWER(REGEXP_REPLACE(TRIM(COALESCE(service_street, '')), '[^a-z0-9]', '', 'gi')) AS base_key
        FROM jobber_api_quotes
        WHERE sent_at >= v_cutoff
    ),
    quote_groups AS (
        SELECT
            q.*,
            LOWER(TRIM(COALESCE(q.client_name, ''))) || '|' ||
            LOWER(REGEXP_REPLACE(TRIM(COALESCE(q.service_street, '')), '[^a-z0-9]', '', 'gi')) AS base_key,
            CASE WHEN q.sent_at - LAG(q.sent_at) OVER (
                PARTITION BY
                    LOWER(TRIM(COALESCE(q.client_name, ''))),
                    LOWER(REGEXP_REPLACE(TRIM(COALESCE(q.service_street, '')), '[^a-z0-9]', '', 'gi'))
                ORDER BY q.sent_at
            ) > INTERVAL '28 days' THEN 1 ELSE 0 END AS new_group
        FROM jobber_api_quotes q
        WHERE q.sent_at IS NOT NULL
          AND LOWER(TRIM(COALESCE(q.client_name, ''))) || '|' ||
              LOWER(REGEXP_REPLACE(TRIM(COALESCE(q.service_street, '')), '[^a-z0-9]', '', 'gi'))
              IN (SELECT base_key FROM affected_keys)
    ),
    quote_windowed AS (
        SELECT
            qg.*,
            SUM(new_group) OVER (
                PARTITION BY base_key ORDER BY sent_at
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS group_num
        FROM quote_groups qg
    )
    INSERT INTO jobber_api_opportunities (
        opportunity_key, client_name, client_name_normalized, client_email,
        service_street, service_street_normalized, service_city, service_state, service_zip,
        salesperson, quote_count, quote_numbers, quote_jobber_ids,
        first_quote_sent_at, last_quote_sent_at,
        max_quote_value, min_quote_value, total_quoted_value, won_value,
        is_won, is_lost, is_pending, won_date, won_quote_numbers,
        first_sent_date, revenue_bucket, quote_count_bucket, last_computed_at
    )
    SELECT
        qw.base_key || '|' || qw.group_num,
        MAX(qw.client_name),
        LOWER(TRIM(MAX(qw.client_name))),
        MAX(qw.client_email),
        MAX(qw.service_street),
        LOWER(REGEXP_REPLACE(TRIM(MAX(qw.service_street)), '[^a-z0-9]', '', 'gi')),
        MAX(qw.service_city),
        MAX(qw.service_state),
        MAX(qw.service_zip),

        (SELECT sq.salesperson FROM jobber_api_quotes sq
         WHERE sq.jobber_id = ANY(ARRAY_AGG(qw.jobber_id))
         ORDER BY sq.sent_at DESC NULLS LAST LIMIT 1),

        COUNT(DISTINCT qw.quote_number)::INTEGER,
        STRING_AGG(DISTINCT qw.quote_number::TEXT, ', ' ORDER BY qw.quote_number::TEXT),
        ARRAY_AGG(DISTINCT qw.jobber_id),
        MIN(qw.sent_at),
        MAX(qw.sent_at),
        MAX(qw.total),
        MIN(qw.total) FILTER (WHERE qw.total > 0),
        SUM(qw.total),
        COALESCE(SUM(qw.total) FILTER (WHERE qw.status = 'converted'), 0),
        BOOL_OR(qw.status = 'converted'),
        BOOL_OR(qw.status = 'archived') AND NOT BOOL_OR(qw.status = 'converted'),
        NOT BOOL_OR(qw.status = 'converted') AND NOT BOOL_OR(qw.status = 'archived'),
        MIN(qw.converted_at::DATE) FILTER (WHERE qw.status = 'converted'),
        STRING_AGG(DISTINCT qw.quote_number::TEXT, ', ') FILTER (WHERE qw.status = 'converted'),
        (MIN(qw.sent_at) AT TIME ZONE 'America/Chicago')::DATE,

        CASE
            WHEN MAX(qw.total) < 1000 THEN '$0-$1K'
            WHEN MAX(qw.total) < 2000 THEN '$1K-$2K'
            WHEN MAX(qw.total) < 5000 THEN '$2K-$5K'
            WHEN MAX(qw.total) < 10000 THEN '$5K-$10K'
            WHEN MAX(qw.total) < 25000 THEN '$10K-$25K'
            WHEN MAX(qw.total) < 50000 THEN '$25K-$50K'
            ELSE '$50K+'
        END,

        CASE
            WHEN COUNT(DISTINCT qw.quote_number) = 1 THEN '1 quote'
            WHEN COUNT(DISTINCT qw.quote_number) = 2 THEN '2 quotes'
            WHEN COUNT(DISTINCT qw.quote_number) = 3 THEN '3 quotes'
            ELSE '4+ quotes'
        END,

        NOW()
    FROM quote_windowed qw
    GROUP BY qw.base_key, qw.group_num;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Step 3: Link jobs only for recomputed opportunities
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
            COUNT(DISTINCT j.job_number)::INTEGER AS job_count,
            STRING_AGG(DISTINCT j.job_number::TEXT, ', ') AS job_numbers,
            ARRAY_AGG(DISTINCT j.jobber_id) FILTER (WHERE j.jobber_id IS NOT NULL) AS job_jobber_ids,
            MIN(j.scheduled_start_at::DATE) AS scheduled_date,
            MAX(COALESCE(j.closed_at, j.completed_at)::DATE) AS closed_date,
            SUM(j.total) AS actual_revenue
        FROM jobber_api_quotes q
        JOIN jobber_api_jobs j ON j.quote_jobber_id = q.jobber_id
        GROUP BY q.jobber_id
    ) sub
    WHERE o.quote_jobber_ids @> ARRAY[sub.quote_jobber_id]
      AND o.last_computed_at >= NOW() - INTERVAL '1 minute';

    -- Step 4: Link requests only for recomputed opportunities
    UPDATE jobber_api_opportunities o
    SET
        request_jobber_id = r.jobber_id,
        assessment_date = r.assessment_start_at::DATE
    FROM jobber_api_requests r
    WHERE r.quote_jobber_ids && o.quote_jobber_ids
      AND r.assessment_start_at IS NOT NULL
      AND o.last_computed_at >= NOW() - INTERVAL '1 minute';

    -- Step 5: Compute cycle times only for recomputed opportunities
    UPDATE jobber_api_opportunities o
    SET
        days_to_quote = CASE
            WHEN first_quote_sent_at IS NOT NULL AND assessment_date IS NOT NULL
                 AND (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE >= assessment_date
            THEN (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE - assessment_date
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
        END,
        days_to_schedule = CASE
            WHEN scheduled_date IS NOT NULL AND won_date IS NOT NULL
                 AND scheduled_date >= won_date
            THEN scheduled_date - won_date
        END,
        days_to_close = CASE
            WHEN closed_date IS NOT NULL AND scheduled_date IS NOT NULL
                 AND closed_date >= scheduled_date
            THEN closed_date - scheduled_date
        END,
        total_cycle_days = CASE
            WHEN closed_date IS NOT NULL AND assessment_date IS NOT NULL
                 AND closed_date >= assessment_date
            THEN closed_date - assessment_date
        END
    WHERE o.last_computed_at >= NOW() - INTERVAL '1 minute';

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_api_opportunities() TO authenticated;
GRANT EXECUTE ON FUNCTION compute_api_opportunities() TO service_role;
