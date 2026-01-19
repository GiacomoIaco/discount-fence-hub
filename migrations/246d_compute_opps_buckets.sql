-- Step 3: Compute derived fields (buckets only, no joins)
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
