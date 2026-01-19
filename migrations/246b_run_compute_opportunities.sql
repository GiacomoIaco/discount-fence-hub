-- Run the compute function manually
-- This is a one-time execution to populate opportunities

-- Step 1: Truncate and insert
TRUNCATE TABLE jobber_api_opportunities;

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
