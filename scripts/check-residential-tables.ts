import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

async function checkTables() {
  console.log('Checking residential analytics tables...\n');

  // Check opportunities
  const { count: oppCount } = await supabase
    .from('jobber_residential_opportunities')
    .select('*', { count: 'exact', head: true });
  console.log(`Opportunities: ${oppCount || 0}`);

  // Check jobs
  const { count: jobCount, error: jobError } = await supabase
    .from('jobber_residential_jobs')
    .select('*', { count: 'exact', head: true });

  if (jobError) {
    console.log(`Jobs: ERROR - ${jobError.message}`);
  } else {
    console.log(`Jobs: ${jobCount || 0}`);
  }

  // Check requests
  const { count: reqCount, error: reqError } = await supabase
    .from('jobber_residential_requests')
    .select('*', { count: 'exact', head: true });

  if (reqError) {
    console.log(`Requests: ERROR - ${reqError.message}`);
  } else {
    console.log(`Requests: ${reqCount || 0}`);
  }

  // Check warranty metrics RPC
  console.log('\nTesting warranty metrics RPC...');
  const { data: warrantyData, error: warrantyError } = await supabase.rpc('get_residential_warranty_metrics', {
    p_start_date: null,
    p_end_date: null,
    p_baseline_weeks: 8,
  });

  if (warrantyError) {
    console.log(`Warranty RPC: ERROR - ${warrantyError.message}`);
  } else {
    console.log('Warranty RPC result:', warrantyData);
  }

  // Check request metrics RPC
  console.log('\nTesting request metrics RPC...');
  const { data: requestData, error: requestError } = await supabase.rpc('get_residential_request_metrics', {
    p_start_date: null,
    p_end_date: null,
  });

  if (requestError) {
    console.log(`Request RPC: ERROR - ${requestError.message}`);
  } else {
    console.log('Request RPC result:', requestData);
  }

  // Check if jobs have warranty data
  console.log('\nChecking job revenue distribution...');
  const { data: revenueData } = await supabase
    .from('jobber_residential_jobs')
    .select('total_revenue, is_warranty')
    .limit(10);

  if (revenueData && revenueData.length > 0) {
    console.log('Sample jobs:', revenueData);
  } else {
    console.log('No jobs found');
  }
}

checkTables().catch(console.error);
