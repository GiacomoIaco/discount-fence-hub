import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkQuotesSchema() {
  console.log('Checking quotes table columns...\n');

  // List of columns referenced in compute_quote_status function
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

  const { data, error } = await supabase.rpc('exec_sql', {
    sql_string: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'quotes'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Raw data:', JSON.stringify(data, null, 2));

  console.log('\nAll columns in quotes table:');
  console.log('============================');

  const existingColumns = new Set<string>();

  // Handle different response formats
  const rows = Array.isArray(data) ? data : (data?.rows || []);

  for (const col of rows) {
    existingColumns.add(col.column_name);
    console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'required'})`);
  }

  console.log('\n\nColumns referenced in compute_quote_status:');
  console.log('============================================');

  for (const col of columnsToCheck) {
    const exists = existingColumns.has(col);
    console.log(`  ${col}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
  }
}

checkQuotesSchema();
