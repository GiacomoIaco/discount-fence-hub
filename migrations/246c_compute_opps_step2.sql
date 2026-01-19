-- Step 2: Update job linkage
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

-- Step 3: Compute derived fields
UPDATE jobber_api_opportunities
SET
    first_sent_date = (first_quote_sent_at AT TIME ZONE 'America/Chicago')::DATE,
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
WHERE TRUE;
