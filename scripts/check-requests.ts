import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Check requests table
  const { count: requestCount } = await supabase
    .from('jobber_api_requests')
    .select('*', { count: 'exact', head: true });
  console.log('Requests in table:', requestCount);

  // Check opportunities table
  const { count: oppCount } = await supabase
    .from('jobber_api_opportunities')
    .select('*', { count: 'exact', head: true });
  console.log('Opportunities in table:', oppCount);

  // Check sync status
  const { data: status } = await supabase
    .from('jobber_sync_status')
    .select('*')
    .eq('id', 'residential')
    .single();
  console.log('\nSync status:', status?.last_sync_status);
  console.log('Requests synced (status):', status?.requests_synced);
}

check();
