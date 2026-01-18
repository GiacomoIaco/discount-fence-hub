import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function checkStatus() {
  // Check sync status
  console.log('=== SYNC STATUS ===');
  const { data: status } = await supabase
    .from('jobber_sync_status')
    .select('*')
    .eq('id', 'residential')
    .single();
  console.log(JSON.stringify(status, null, 2));

  // Check table counts
  console.log('\n=== TABLE COUNTS ===');
  const [quotes, jobs, requests, opps] = await Promise.all([
    supabase.from('jobber_api_quotes').select('*', { count: 'exact', head: true }),
    supabase.from('jobber_api_jobs').select('*', { count: 'exact', head: true }),
    supabase.from('jobber_api_requests').select('*', { count: 'exact', head: true }),
    supabase.from('jobber_api_opportunities').select('*', { count: 'exact', head: true }),
  ]);
  console.log('Quotes:', quotes.count);
  console.log('Jobs:', jobs.count);
  console.log('Requests:', requests.count);
  console.log('Opportunities:', opps.count);

  // Check sample quote dates
  console.log('\n=== SAMPLE QUOTE DATES ===');
  const { data: sampleQuotes } = await supabase
    .from('jobber_api_quotes')
    .select('quote_number, drafted_at, synced_at')
    .order('drafted_at', { ascending: true })
    .limit(3);
  console.log('Oldest quotes:', sampleQuotes);

  const { data: newestQuotes } = await supabase
    .from('jobber_api_quotes')
    .select('quote_number, drafted_at, synced_at')
    .order('drafted_at', { ascending: false })
    .limit(3);
  console.log('Newest quotes:', newestQuotes);
}

checkStatus();
