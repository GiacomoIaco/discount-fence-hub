// Check ALL residential RPC functions
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkFunctions() {
  console.log('Testing ALL residential RPC functions...\n');

  const tests = [
    { name: 'get_residential_funnel_metrics', params: { p_start_date: null, p_end_date: null, p_salesperson: null, p_revenue_bucket: null, p_speed_bucket: null } },
    { name: 'get_residential_salesperson_metrics', params: { p_start_date: null, p_end_date: null, p_revenue_bucket: null } },
    { name: 'get_residential_bucket_metrics', params: { p_start_date: null, p_end_date: null, p_salesperson: null, p_speed_bucket: null } },
    { name: 'get_residential_speed_metrics', params: { p_start_date: null, p_end_date: null, p_salesperson: null, p_revenue_bucket: null } },
    { name: 'get_residential_speed_by_size_matrix', params: { p_start_date: null, p_end_date: null, p_salesperson: null } },
    { name: 'get_residential_quote_count_metrics', params: { p_start_date: null, p_end_date: null, p_revenue_bucket: null } },
    { name: 'get_residential_monthly_totals', params: { p_months: 12, p_revenue_bucket: null } },
    { name: 'get_residential_salesperson_monthly', params: { p_months: 12, p_revenue_bucket: null } },
  ];

  for (const test of tests) {
    const { data, error } = await supabase.rpc(test.name, test.params);

    if (error) {
      console.log(`❌ ${test.name}:`);
      console.log(`   ERROR: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      if (error.details) console.log(`   Details: ${error.details}`);
    } else {
      const count = Array.isArray(data) ? data.length : 1;
      console.log(`✅ ${test.name}: ${count} rows`);
      // Show first row columns
      if (Array.isArray(data) && data[0]) {
        console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
      } else if (data) {
        console.log(`   Columns: ${Object.keys(data).join(', ')}`);
      }
    }
  }
}

checkFunctions().catch(console.error);
