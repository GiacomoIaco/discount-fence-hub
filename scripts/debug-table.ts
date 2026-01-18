import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  // Get sample records with all relevant columns
  const { data, error } = await supabase
    .from('jobber_residential_opportunities')
    .select('opportunity_key, assessment_date, requested_date, request_date, first_quote_date, first_quote_sent_date, days_to_quote, speed_to_quote_bucket')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== SAMPLE OPPORTUNITIES ===\n');
  console.table(data);

  // Check counts
  const { data: counts } = await supabase
    .from('jobber_residential_opportunities')
    .select('assessment_date, requested_date, first_quote_sent_date, days_to_quote');

  if (counts) {
    console.log('\n=== COLUMN COUNTS ===');
    console.log(`Total: ${counts.length}`);
    console.log(`Has assessment_date: ${counts.filter(c => c.assessment_date).length}`);
    console.log(`Has requested_date: ${counts.filter(c => c.requested_date).length}`);
    console.log(`Has first_quote_sent_date: ${counts.filter(c => c.first_quote_sent_date).length}`);
    console.log(`Has days_to_quote (non-null): ${counts.filter(c => c.days_to_quote !== null).length}`);
    console.log(`days_to_quote = 0: ${counts.filter(c => c.days_to_quote === 0).length}`);
    console.log(`days_to_quote > 0: ${counts.filter(c => c.days_to_quote !== null && c.days_to_quote > 0).length}`);
  }

  // Check a specific record that should have non-zero
  const { data: specific } = await supabase
    .from('jobber_residential_opportunities')
    .select('*')
    .eq('opportunity_key', 'kim mendez|2 valbella drive')
    .single();

  if (specific) {
    console.log('\n=== SPECIFIC RECORD (kim mendez) ===');
    console.log(`assessment_date: ${specific.assessment_date}`);
    console.log(`requested_date: ${specific.requested_date}`);
    console.log(`first_quote_sent_date: ${specific.first_quote_sent_date}`);
    console.log(`days_to_quote: ${specific.days_to_quote}`);
    console.log(`speed_to_quote_bucket: ${specific.speed_to_quote_bucket}`);
  }
}

debug().catch(console.error);
