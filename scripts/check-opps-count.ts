import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { count } = await supabase
    .from('jobber_api_opportunities')
    .select('*', { count: 'exact', head: true });
  console.log('Opportunities count:', count);

  // Sample data
  const { data } = await supabase
    .from('jobber_api_opportunities')
    .select('client_name, max_quote_value, is_won, quote_count')
    .limit(5);
  console.log('\nSample opportunities:', JSON.stringify(data, null, 2));
}

check();
