import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function fixAndCompute() {
  // 1. Compute opportunities from existing data
  console.log('Computing opportunities...');
  const { data: oppsCount, error: oppsError } = await supabase.rpc('compute_api_opportunities');
  
  if (oppsError) {
    console.error('Error computing opportunities:', oppsError);
  } else {
    console.log('Opportunities computed:', oppsCount);
  }

  // 2. Update sync status to success with actual counts
  const [quotes, jobs, requests, opps] = await Promise.all([
    supabase.from('jobber_api_quotes').select('*', { count: 'exact', head: true }),
    supabase.from('jobber_api_jobs').select('*', { count: 'exact', head: true }),
    supabase.from('jobber_api_requests').select('*', { count: 'exact', head: true }),
    supabase.from('jobber_api_opportunities').select('*', { count: 'exact', head: true }),
  ]);

  console.log('\nUpdating sync status...');
  const { error: updateError } = await supabase
    .from('jobber_sync_status')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_type: 'full',
      last_sync_status: 'success',
      last_error: null,
      quotes_synced: quotes.count || 0,
      jobs_synced: jobs.count || 0,
      requests_synced: requests.count || 0,
      opportunities_computed: opps.count || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'residential');

  if (updateError) {
    console.error('Error updating status:', updateError);
  } else {
    console.log('Sync status updated to success');
  }

  // 3. Show final counts
  console.log('\n=== FINAL COUNTS ===');
  console.log('Quotes:', quotes.count);
  console.log('Jobs:', jobs.count);
  console.log('Requests:', requests.count);
  console.log('Opportunities:', opps.count);
}

fixAndCompute();
