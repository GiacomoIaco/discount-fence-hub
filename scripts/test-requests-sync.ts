import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function testRequestsSync() {
  // Check if there are any requests in the raw API response
  console.log('Checking jobber_api_requests table...');
  const { count } = await supabase
    .from('jobber_api_requests')
    .select('*', { count: 'exact', head: true });
  console.log('Requests in table:', count);

  // Check sync status for last error
  const { data: status } = await supabase
    .from('jobber_sync_status')
    .select('*')
    .eq('id', 'residential')
    .single();
  console.log('\nSync status:', JSON.stringify(status, null, 2));
}

testRequestsSync();
