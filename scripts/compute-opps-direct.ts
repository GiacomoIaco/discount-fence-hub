import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function computeOpps() {
  console.log('Step 1: Truncating and inserting opportunities...');

  // Run step by step to identify which part fails
  const step1 = await supabase.rpc('exec_sql', {
    sql: `
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
    `
  });

  if (step1.error) {
    console.error('Step 1 failed:', step1.error.message);
    return;
  }
  console.log('Step 1 done');

  // Check count
  const { count } = await supabase
    .from('jobber_api_opportunities')
    .select('*', { count: 'exact', head: true });
  console.log('Opportunities created:', count);

  console.log('\nStep 2: Updating job linkage...');
  const step2 = await supabase.rpc('exec_sql', {
    sql: `
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
    `
  });

  if (step2.error) {
    console.error('Step 2 failed:', step2.error.message);
  } else {
    console.log('Step 2 done');
  }

  console.log('\nStep 3: Computing derived fields...');
  const step3 = await supabase.rpc('exec_sql', {
    sql: `
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
    `
  });

  if (step3.error) {
    console.error('Step 3 failed:', step3.error.message);
  } else {
    console.log('Step 3 done');
  }

  // Final count
  const { count: finalCount } = await supabase
    .from('jobber_api_opportunities')
    .select('*', { count: 'exact', head: true });
  console.log('\nFinal opportunities count:', finalCount);
}

computeOpps();
