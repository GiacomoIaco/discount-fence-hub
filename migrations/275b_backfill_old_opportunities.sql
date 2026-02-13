-- One-time backfill: link requests + salesperson for OLD opportunities
-- that weren't covered by the 128-day incremental window
SET statement_timeout = '120s';

-- Pre-normalize requests
CREATE TEMP TABLE _req_norm AS
SELECT
    jobber_id, salesperson, assessment_start_at, created_at,
    LOWER(TRIM(COALESCE(client_name, ''))) AS cn,
    LOWER(REGEXP_REPLACE(TRIM(COALESCE(service_street, '')), '[^a-z0-9]', '', 'gi')) AS ss
FROM jobber_api_requests
WHERE assessment_start_at IS NOT NULL OR (salesperson IS NOT NULL AND salesperson != '');

CREATE INDEX ON _req_norm (cn, ss);

-- Link assessment + salesperson to old opps that are missing them
UPDATE jobber_api_opportunities o
SET
    request_jobber_id = best.jobber_id,
    assessment_date = best.assessment_start_at::DATE,
    salesperson = best.salesperson
FROM (
    SELECT DISTINCT ON (o2.id)
        o2.id AS opp_id,
        rn.jobber_id,
        rn.assessment_start_at,
        rn.salesperson
    FROM jobber_api_opportunities o2
    JOIN _req_norm rn ON rn.cn = o2.client_name_normalized AND rn.ss = o2.service_street_normalized
    WHERE o2.assessment_date IS NULL
      AND rn.assessment_start_at IS NOT NULL
      AND rn.assessment_start_at <= o2.first_quote_sent_at + INTERVAL '7 days'
      AND rn.assessment_start_at >= o2.first_quote_sent_at - INTERVAL '60 days'
    ORDER BY o2.id, rn.assessment_start_at DESC
) best
WHERE o.id = best.opp_id;

-- Fallback salesperson for remaining
UPDATE jobber_api_opportunities o
SET salesperson = fb.salesperson
FROM (
    SELECT DISTINCT ON (o2.id)
        o2.id AS opp_id,
        rn.salesperson
    FROM jobber_api_opportunities o2
    JOIN _req_norm rn ON rn.cn = o2.client_name_normalized AND rn.ss = o2.service_street_normalized
    WHERE o2.salesperson IS NULL
      AND rn.salesperson IS NOT NULL AND rn.salesperson != ''
    ORDER BY o2.id, rn.created_at DESC
) fb
WHERE o.id = fb.opp_id;

DROP TABLE _req_norm;

-- Compute cycle times for newly linked opps
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
WHERE assessment_date IS NOT NULL AND days_to_quote IS NULL;
