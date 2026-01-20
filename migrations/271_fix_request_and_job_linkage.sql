-- ============================================================================
-- Migration 271: Fix Request Metrics Column Names & Job Linkage
--
-- Issues Fixed:
-- 1. Request metrics function used wrong column names (created_date → created_at_jobber)
-- 2. Job linkage UPDATE in compute_api_opportunities times out
-- ============================================================================

-- ============================================
-- 1. FIX REQUEST METRICS - Use correct column names
-- ============================================

DROP FUNCTION IF EXISTS get_api_residential_request_metrics(DATE, DATE);

CREATE OR REPLACE FUNCTION get_api_residential_request_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_requests BIGINT,
    assessments_scheduled BIGINT,
    assessments_completed BIGINT,
    converted_to_quote BIGINT,
    conversion_rate NUMERIC,
    avg_days_to_assessment NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_requests,
        -- assessment_start_at is the scheduled assessment time
        COUNT(*) FILTER (WHERE r.assessment_start_at IS NOT NULL)::BIGINT AS assessments_scheduled,
        -- assessment_completed_at indicates completion
        COUNT(*) FILTER (WHERE r.assessment_completed_at IS NOT NULL)::BIGINT AS assessments_completed,
        -- Check if quote_jobber_ids array is not empty
        COUNT(*) FILTER (WHERE r.quote_jobber_ids IS NOT NULL AND array_length(r.quote_jobber_ids, 1) > 0)::BIGINT AS converted_to_quote,
        ROUND(
            CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE 100.0 * COUNT(*) FILTER (WHERE r.quote_jobber_ids IS NOT NULL AND array_length(r.quote_jobber_ids, 1) > 0) / COUNT(*)
            END, 1
        ) AS conversion_rate,
        ROUND(AVG(
            EXTRACT(EPOCH FROM (r.assessment_start_at - r.created_at_jobber)) / 86400.0
        ) FILTER (WHERE r.assessment_start_at IS NOT NULL AND r.created_at_jobber IS NOT NULL)::NUMERIC, 1) AS avg_days_to_assessment
    FROM jobber_api_requests r
    -- Use created_at_jobber (the actual column name) for date filtering
    WHERE (p_start_date IS NULL OR r.created_at_jobber::DATE >= p_start_date)
        AND (p_end_date IS NULL OR r.created_at_jobber::DATE <= p_end_date);
END;
$fn$;

GRANT EXECUTE ON FUNCTION get_api_residential_request_metrics TO authenticated;


-- ============================================
-- 2. RUN JOB LINKAGE UPDATE SEPARATELY
-- This is the part that was timing out in compute_api_opportunities()
-- ============================================

-- Update job linkage in batches to avoid timeout
DO $$
DECLARE
    v_updated INTEGER := 0;
    v_batch INTEGER := 0;
BEGIN
    -- Update opportunities with their job data
    -- Using a direct join approach instead of subquery with @> operator

    UPDATE jobber_api_opportunities o
    SET
        job_count = agg.job_count,
        job_numbers = agg.job_numbers,
        job_jobber_ids = agg.job_jobber_ids,
        scheduled_date = agg.scheduled_date,
        closed_date = agg.closed_date,
        actual_revenue = agg.actual_revenue
    FROM (
        SELECT
            o2.id AS opp_id,
            COUNT(DISTINCT j.job_number)::INTEGER AS job_count,
            STRING_AGG(DISTINCT j.job_number::TEXT, ', ') AS job_numbers,
            ARRAY_AGG(DISTINCT j.jobber_id) FILTER (WHERE j.jobber_id IS NOT NULL) AS job_jobber_ids,
            MIN(j.scheduled_start_at::DATE) AS scheduled_date,
            MAX(COALESCE(j.closed_at, j.completed_at)::DATE) AS closed_date,
            SUM(j.total) AS actual_revenue
        FROM jobber_api_opportunities o2
        JOIN jobber_api_jobs j ON j.quote_jobber_id = ANY(o2.quote_jobber_ids)
        GROUP BY o2.id
    ) agg
    WHERE o.id = agg.opp_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % opportunities with job data', v_updated;

    -- Now update the derived cycle time fields
    UPDATE jobber_api_opportunities o
    SET
        -- Days to Schedule: Converted -> Scheduled
        days_to_schedule = CASE
            WHEN o.scheduled_date IS NOT NULL AND o.won_date IS NOT NULL
                 AND o.scheduled_date >= o.won_date
            THEN o.scheduled_date - o.won_date
            ELSE NULL
        END,
        -- Days to Close: Scheduled -> Closed
        days_to_close = CASE
            WHEN o.closed_date IS NOT NULL AND o.scheduled_date IS NOT NULL
                 AND o.closed_date >= o.scheduled_date
            THEN o.closed_date - o.scheduled_date
            ELSE NULL
        END,
        -- Total Cycle: Assessment -> Closed
        total_cycle_days = CASE
            WHEN o.closed_date IS NOT NULL AND o.assessment_date IS NOT NULL
                 AND o.closed_date >= o.assessment_date
            THEN o.closed_date - o.assessment_date
            ELSE NULL
        END
    WHERE o.scheduled_date IS NOT NULL OR o.closed_date IS NOT NULL;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'Updated cycle times for % opportunities', v_updated;
END $$;


-- ============================================
-- 3. VERIFY RESULTS
-- ============================================

-- Show job linkage results
SELECT
    'Job Linkage' AS metric,
    COUNT(*) FILTER (WHERE scheduled_date IS NOT NULL) AS with_scheduled,
    COUNT(*) FILTER (WHERE closed_date IS NOT NULL) AS with_closed,
    COUNT(*) FILTER (WHERE job_count > 0) AS with_jobs,
    COUNT(*) FILTER (WHERE is_won) AS total_won
FROM jobber_api_opportunities;

-- Show cycle time coverage
SELECT
    'Cycle Times' AS metric,
    COUNT(*) FILTER (WHERE days_to_schedule IS NOT NULL) AS with_schedule_time,
    COUNT(*) FILTER (WHERE days_to_close IS NOT NULL) AS with_close_time,
    COUNT(*) FILTER (WHERE total_cycle_days IS NOT NULL) AS with_total_cycle,
    ROUND(AVG(days_to_schedule) FILTER (WHERE days_to_schedule IS NOT NULL)::NUMERIC, 1) AS avg_days_to_schedule,
    ROUND(AVG(days_to_close) FILTER (WHERE days_to_close IS NOT NULL)::NUMERIC, 1) AS avg_days_to_close
FROM jobber_api_opportunities WHERE is_won;


-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Track migration
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('271', 'fix_request_and_job_linkage', 'claude', 0)
ON CONFLICT (version) DO NOTHING;
