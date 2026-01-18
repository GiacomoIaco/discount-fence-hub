import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function computeOpps() {
  console.log('Computing opportunities...');
  console.log('This may take a few minutes...');

  const startTime = Date.now();

  // Call the compute function
  const { data, error } = await supabase.rpc('compute_api_opportunities');

  const duration = (Date.now() - startTime) / 1000;

  if (error) {
    console.error('Failed after ' + duration + 's:', error.message);

    // Check final counts anyway
    const { count } = await supabase
      .from('jobber_api_opportunities')
      .select('*', { count: 'exact', head: true });
    console.log('Opportunities in table:', count);
  } else {
    console.log('Success! Computed ' + data + ' opportunities in ' + duration + 's');
  }
}

computeOpps();
