-- Step 3: Link requests and salesperson to opportunities
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
    ORDER BY o.id, r.assessment_start_at DESC
)
UPDATE jobber_api_opportunities o
SET
    request_jobber_id = rd.request_id,
    assessment_date = rd.assessment_date,
    salesperson = rd.salesperson
FROM request_data rd
WHERE o.id = rd.opp_id;
