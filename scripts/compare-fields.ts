import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function compareFields() {
  // Get sample API quote
  console.log('=== API QUOTE SAMPLE ===');
  const { data: apiQuote } = await supabase
    .from('jobber_api_quotes')
    .select('*')
    .limit(1)
    .single();
  console.log('Fields:', Object.keys(apiQuote || {}).join(', '));
  console.log('Sample:', JSON.stringify(apiQuote, null, 2));

  // Get sample API job
  console.log('\n=== API JOB SAMPLE ===');
  const { data: apiJob } = await supabase
    .from('jobber_api_jobs')
    .select('*')
    .limit(1)
    .single();
  console.log('Fields:', Object.keys(apiJob || {}).join(', '));

  // Get sample API opportunity
  console.log('\n=== API OPPORTUNITY SAMPLE ===');
  const { data: apiOpp } = await supabase
    .from('jobber_api_opportunities')
    .select('*')
    .eq('is_won', true)
    .limit(1)
    .single();
  console.log('Fields:', Object.keys(apiOpp || {}).join(', '));
  console.log('Sample:', JSON.stringify(apiOpp, null, 2));

  // Check for salesperson field
  console.log('\n=== CHECKING SALESPERSON IN RAW DATA ===');
  const { data: quoteWithRaw } = await supabase
    .from('jobber_api_quotes')
    .select('raw_data')
    .limit(1)
    .single();
  console.log('Raw data keys:', Object.keys((quoteWithRaw as { raw_data: Record<string, unknown> })?.raw_data || {}));
}

compareFields();
