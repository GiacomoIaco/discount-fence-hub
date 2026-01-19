import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Check quotes with discounts
  const { data: quotes } = await supabase
    .from('jobber_api_quotes')
    .select('quote_number, total, subtotal, discount')
    .gt('discount', 0)
    .limit(5);
  
  console.log('Quotes with discounts:', quotes);
  
  // Count quotes with discounts
  const { count } = await supabase
    .from('jobber_api_quotes')
    .select('*', { count: 'exact', head: true })
    .gt('discount', 0);
  
  console.log('\nTotal quotes with discount > 0:', count);
}

check();
