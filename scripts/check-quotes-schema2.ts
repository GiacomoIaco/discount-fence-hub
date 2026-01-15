import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkQuotesSchema() {
  console.log('Checking quotes table columns by querying a single row...\n');

  // Get a single quote to see what columns exist
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Columns found in quotes table:');
  console.log('==============================');

  const columns = Object.keys(data);
  columns.sort();

  for (const col of columns) {
    console.log(`  ${col}`);
  }

  // Check specific columns
  const columnsToCheck = [
    'converted_to_job_id',
    'lost_reason',
    'lost_at',
    'archived_at',
    'approval_requested_at',
    'manager_approved_at',
    'manager_rejected_at',
    'client_approved_at',
    'approval_status',
    'changes_requested_at',
    'sent_at',
    'viewed_at',
    'valid_until'
  ];

  console.log('\n\nColumns referenced in compute_quote_status:');
  console.log('============================================');

  for (const col of columnsToCheck) {
    const exists = columns.includes(col);
    console.log(`  ${col}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
  }
}

checkQuotesSchema();
