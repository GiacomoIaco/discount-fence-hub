import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const jobId = 'f9140f9c-a32a-42cb-bc00-d202a56ec08e'; // JOB-2026-0004

  // Check current job state
  console.log('Current job state:');
  const { data: job } = await supabase
    .from('jobs')
    .select('job_number, status, scheduled_date, assigned_crew_id, work_started_at, work_completed_at')
    .eq('id', jobId)
    .single();

  console.log(job);

  // Mark job as completed
  console.log('\nMarking job as completed...');
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('jobs')
    .update({
      work_started_at: now,
      work_completed_at: now
    })
    .eq('id', jobId);

  if (error) {
    console.error('Error completing job:', error.message);
    return;
  }

  console.log('✅ Job marked as completed!');

  // Verify
  const { data: updated } = await supabase
    .from('jobs')
    .select('job_number, status, work_started_at, work_completed_at')
    .eq('id', jobId)
    .single();

  console.log('\nUpdated job state:', updated);
}

main().catch(console.error);
