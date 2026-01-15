// Check if RPC functions exist and work
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkFunctions() {
  console.log('Testing RPC functions...\n');

  // Test get_residential_funnel_metrics
  console.log('1. get_residential_funnel_metrics:');
  const { data: funnel, error: funnelError } = await supabase.rpc('get_residential_funnel_metrics', {
    p_start_date: null,
    p_end_date: null,
    p_salesperson: null,
    p_revenue_bucket: null,
    p_speed_bucket: null,
  });
  if (funnelError) {
    console.log(`   ERROR: ${funnelError.message}`);
    console.log(`   Code: ${funnelError.code}`);
    console.log(`   Details: ${funnelError.details}`);
  } else {
    console.log(`   OK - Total: ${funnel?.[0]?.total_opportunities || funnel?.total_opportunities}`);
  }

  // Test get_residential_salesperson_metrics
  console.log('\n2. get_residential_salesperson_metrics:');
  const { data: sp, error: spError } = await supabase.rpc('get_residential_salesperson_metrics', {
    p_start_date: null,
    p_end_date: null,
    p_revenue_bucket: null,
  });
  if (spError) {
    console.log(`   ERROR: ${spError.message}`);
    console.log(`   Code: ${spError.code}`);
    console.log(`   Details: ${spError.details}`);
  } else {
    console.log(`   OK - ${sp?.length || 0} salespeople`);
    if (sp?.[0]) {
      console.log(`   First: ${sp[0].salesperson}, won_value: ${sp[0].won_value}`);
    }
  }

  // Test get_residential_bucket_metrics
  console.log('\n3. get_residential_bucket_metrics:');
  const { data: bucket, error: bucketError } = await supabase.rpc('get_residential_bucket_metrics', {
    p_start_date: null,
    p_end_date: null,
    p_salesperson: null,
    p_speed_bucket: null,
  });
  if (bucketError) {
    console.log(`   ERROR: ${bucketError.message}`);
  } else {
    console.log(`   OK - ${bucket?.length || 0} buckets`);
  }

  // Test get_residential_speed_metrics
  console.log('\n4. get_residential_speed_metrics:');
  const { data: speed, error: speedError } = await supabase.rpc('get_residential_speed_metrics', {
    p_start_date: null,
    p_end_date: null,
    p_salesperson: null,
    p_revenue_bucket: null,
  });
  if (speedError) {
    console.log(`   ERROR: ${speedError.message}`);
  } else {
    console.log(`   OK - ${speed?.length || 0} speed buckets`);
  }
}

checkFunctions().catch(console.error);
