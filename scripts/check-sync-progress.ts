import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Check sync status
  const { data: status } = await supabase
    .from('jobber_sync_status')
    .select('*')
    .eq('id', 'residential')
    .single();

  console.log('=== SYNC STATUS ===');
  console.log('Status:', status?.last_sync_status);
  console.log('Last Sync At:', status?.last_sync_at);
  console.log('Quotes synced:', status?.quotes_synced);
  console.log('Jobs synced:', status?.jobs_synced);
  console.log('Requests synced:', status?.requests_synced);
  console.log('Opportunities computed:', status?.opportunities_computed);
  console.log('Last Error:', status?.last_error);

  // Check actual table counts
  const { count: quoteCount } = await supabase.from('jobber_api_quotes').select('*', { count: 'exact', head: true });
  const { count: jobCount } = await supabase.from('jobber_api_jobs').select('*', { count: 'exact', head: true });
  const { count: requestCount } = await supabase.from('jobber_api_requests').select('*', { count: 'exact', head: true });
  const { count: oppCount } = await supabase.from('jobber_api_opportunities').select('*', { count: 'exact', head: true });

  console.log('\n=== TABLE COUNTS ===');
  console.log('Quotes in DB:', quoteCount);
  console.log('Jobs in DB:', jobCount);
  console.log('Requests in DB:', requestCount);
  console.log('Opportunities in DB:', oppCount);

  // Check salesperson distribution
  const { data: salespeople } = await supabase
    .from('jobber_api_requests')
    .select('salesperson')
    .not('salesperson', 'is', null)
    .limit(5);

  console.log('\n=== SALESPERSON SAMPLE ===');
  console.log('Sample requests with salesperson:', salespeople);
}

check();
