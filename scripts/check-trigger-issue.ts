import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // Check service_requests columns
  console.log('SERVICE_REQUESTS COLUMNS:');
  const { data: cols } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'service_requests'
      AND column_name LIKE '%converted%' OR column_name LIKE '%project%'
      ORDER BY column_name;
    `
  });
  console.log(cols);

  // Check triggers on service_requests
  console.log('\nTRIGGERS ON SERVICE_REQUESTS:');
  const { data: triggers } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'service_requests';
    `
  });
  console.log(triggers);

  // Check if converted_to_project_id exists
  console.log('\nCHECKING FOR converted_to_project_id:');
  const { data: check } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'service_requests'
      AND column_name = 'converted_to_project_id';
    `
  });
  console.log(check || 'Column does not exist');
}

main().catch(console.error);
