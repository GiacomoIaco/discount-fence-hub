import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function test() {
  console.log('Testing get_api_residential_cycle_breakdown...');

  const { data, error } = await supabase.rpc('get_api_residential_cycle_breakdown', {
    p_start_date: null,
    p_end_date: null,
    p_salesperson: null
  });

  if (error) {
    console.log('Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Success! Rows returned:', data?.length || 0);
    console.log('Data:', JSON.stringify(data, null, 2));
  }

  // Also check if the opportunities table exists and has data
  console.log('\nChecking jobber_api_opportunities table...');
  const { data: opps, error: oppsError, count } = await supabase
    .from('jobber_api_opportunities')
    .select('*', { count: 'exact', head: true });

  if (oppsError) {
    console.log('Opportunities table error:', oppsError.message);
  } else {
    console.log('Opportunities count:', count);
  }
}

test();
