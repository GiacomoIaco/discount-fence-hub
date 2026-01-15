import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const jobId = 'f9140f9c-a32a-42cb-bc00-d202a56ec08e'; // JOB-2026-0004

  // 1. Find an active crew
  console.log('Finding active crew...');
  const { data: crews, error: e1 } = await supabase
    .from('crews')
    .select('id, name, code')
    .eq('is_active', true)
    .limit(1);

  if (e1 || !crews?.length) {
    console.error('Error finding crew:', e1?.message || 'No crews found');
    return;
  }

  const crew = crews[0];
  console.log(`Found crew: ${crew.name} (${crew.id})`);

  // 2. Update the job with assigned_crew_id
  console.log('\nAssigning crew to job...');
  const { error: e2 } = await supabase
    .from('jobs')
    .update({ assigned_crew_id: crew.id })
    .eq('id', jobId);

  if (e2) {
    console.error('Error assigning crew:', e2.message);
    return;
  }

  console.log('✅ Crew assigned successfully!');

  // 3. Verify the job status
  const { data: job } = await supabase
    .from('jobs')
    .select('job_number, status, scheduled_date, assigned_crew_id')
    .eq('id', jobId)
    .single();

  console.log('\nJob verification:', job);
  console.log(`\nExpected status: scheduled (if date + crew both set)`);
}

main().catch(console.error);
