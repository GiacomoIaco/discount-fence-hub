import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Try to query tickets
  const { error } = await supabase.from('tickets').select('id').limit(1);
  
  if (error) {
    console.log('tickets table: ❌ Does not exist');
    console.log('Error:', error.message);
    console.log('\n217e migration adds columns to tickets table, but the table must exist first.');
    console.log('The Ticket Hub feature may not have been deployed yet.');
  } else {
    console.log('tickets table: ✅ Exists');
  }

  // Check invoices.job_id constraint (217f makes it nullable)
  const { data, error: e2 } = await supabase
    .from('invoices')
    .select('job_id')
    .limit(1);
  console.log('\ninvoices table:', e2 ? `❌ ${e2.message}` : '✅ exists');

  // Check if analytics views exist (217g)
  const { error: e3 } = await supabase.from('v_marketing_funnel').select('*').limit(1);
  console.log('v_marketing_funnel view:', e3 ? `❌ ${e3.message}` : '✅ exists');
}

check();
