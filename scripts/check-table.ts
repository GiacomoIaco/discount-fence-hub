import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkTables() {
  console.log('Checking if 217a-d migrations were applied...\n');

  // Check job_issues table (217d)
  const { data: jobIssues, error: e1 } = await supabase
    .from('job_issues')
    .select('id')
    .limit(1);
  console.log('job_issues table:', e1 ? `❌ ${e1.message}` : '✅ exists');

  // Check quotes.quote_type column (217c)
  const { data: quotes, error: e2 } = await supabase
    .from('quotes')
    .select('quote_type')
    .limit(1);
  console.log('quotes.quote_type:', e2 ? `❌ ${e2.message}` : '✅ exists');

  // Check projects.project_type column (217b)
  const { data: projects, error: e3 } = await supabase
    .from('projects')
    .select('project_type')
    .limit(1);
  console.log('projects.project_type:', e3 ? `❌ ${e3.message}` : '✅ exists');

  // Check service_requests.project_id column (217a)
  const { data: requests, error: e4 } = await supabase
    .from('service_requests')
    .select('project_id')
    .limit(1);
  console.log('service_requests.project_id:', e4 ? `❌ ${e4.message}` : '✅ exists');

  // Check tickets.project_id column (217e)
  const { data: tickets, error: e5 } = await supabase
    .from('tickets')
    .select('project_id')
    .limit(1);
  console.log('tickets.project_id:', e5 ? `❌ ${e5.message}` : '✅ exists');
}

checkTables();
