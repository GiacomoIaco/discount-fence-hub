-- Step 4: Compute derived fields
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
WHERE id IS NOT NULL;
