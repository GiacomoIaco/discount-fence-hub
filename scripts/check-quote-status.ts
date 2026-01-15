import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkQuoteStatuses() {
  console.log('Finding draft quotes that would need manager approval...\n');

  // Find draft quotes with low margin or high total
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('id, quote_number, status, total, margin_percent, discount_percent, approval_requested_at, manager_approved_at, converted_to_job_id')
    .eq('status', 'draft')
    .is('converted_to_job_id', null)
    .gt('total', 0)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Quotes with approval_requested_at:');
  console.log('==================================');

  if (!quotes || quotes.length === 0) {
    console.log('No quotes found with approval_requested_at set.');
    return;
  }

  for (const q of quotes) {
    console.log(`\nQuote: ${q.quote_number}`);
    console.log(`  Status: ${q.status}`);
    console.log(`  approval_requested_at: ${q.approval_requested_at}`);
    console.log(`  manager_approved_at: ${q.manager_approved_at}`);
    console.log(`  manager_rejected_at: ${q.manager_rejected_at}`);
    console.log(`  converted_to_job_id: ${q.converted_to_job_id}`);
  }
}

checkQuoteStatuses();
