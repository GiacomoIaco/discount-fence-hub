// Check residential data counts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkData() {
  console.log('Checking residential data...\n');

  // Check opportunities
  const { count: oppCount, error: oppError } = await supabase
    .from('jobber_residential_opportunities')
    .select('*', { count: 'exact', head: true });

  console.log(`Opportunities: ${oppCount ?? 0} ${oppError ? `(Error: ${oppError.message})` : ''}`);

  // Check quotes
  const { count: quoteCount, error: quoteError } = await supabase
    .from('jobber_residential_quotes')
    .select('*', { count: 'exact', head: true });

  console.log(`Quotes: ${quoteCount ?? 0} ${quoteError ? `(Error: ${quoteError.message})` : ''}`);

  // Check jobs
  const { count: jobCount, error: jobError } = await supabase
    .from('jobber_residential_jobs')
    .select('*', { count: 'exact', head: true });

  console.log(`Jobs: ${jobCount ?? 0} ${jobError ? `(Error: ${jobError.message})` : ''}`);

  // If we have data, show some stats
  if (oppCount && oppCount > 0) {
    const { data: stats } = await supabase.rpc('get_residential_funnel_metrics');
    if (stats && stats[0]) {
      console.log('\n--- Funnel Metrics ---');
      console.log(`Total Opportunities: ${stats[0].total_opportunities}`);
      console.log(`Won: ${stats[0].won_opportunities}`);
      console.log(`Lost: ${stats[0].lost_opportunities}`);
      console.log(`Pending: ${stats[0].pending_opportunities}`);
      console.log(`Win Rate: ${stats[0].win_rate}%`);
      console.log(`Won Value: $${Number(stats[0].won_value).toLocaleString()}`);
    }
  }
}

checkData().catch(console.error);
