import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking date distribution in jobber_builder_jobs...\n');

  // Get total count
  const { count: total } = await supabase
    .from('jobber_builder_jobs')
    .select('id', { count: 'exact', head: true });

  // Get count with closed_date
  const { count: withClosed } = await supabase
    .from('jobber_builder_jobs')
    .select('id', { count: 'exact', head: true })
    .not('closed_date', 'is', null);

  console.log(`Total jobs: ${total}`);
  console.log(`Jobs with closed_date: ${withClosed}`);
  console.log(`Jobs without closed_date: ${(total || 0) - (withClosed || 0)}`);

  // Get min/max dates
  const { data: minMaxCreated } = await supabase
    .from('jobber_builder_jobs')
    .select('created_date')
    .not('created_date', 'is', null)
    .order('created_date', { ascending: true })
    .limit(1)
    .single();

  const { data: maxCreated } = await supabase
    .from('jobber_builder_jobs')
    .select('created_date')
    .not('created_date', 'is', null)
    .order('created_date', { ascending: false })
    .limit(1)
    .single();

  console.log(`\nCreated date range: ${minMaxCreated?.created_date} to ${maxCreated?.created_date}`);

  // Get closed date range
  const { data: minClosed } = await supabase
    .from('jobber_builder_jobs')
    .select('closed_date')
    .not('closed_date', 'is', null)
    .order('closed_date', { ascending: true })
    .limit(1)
    .single();

  const { data: maxClosed } = await supabase
    .from('jobber_builder_jobs')
    .select('closed_date')
    .not('closed_date', 'is', null)
    .order('closed_date', { ascending: false })
    .limit(1)
    .single();

  console.log(`Closed date range: ${minClosed?.closed_date} to ${maxClosed?.closed_date}`);

  // Get monthly distribution of closed_date
  console.log('\nMonthly distribution of closed_date:');
  const { data: closedJobs } = await supabase
    .from('jobber_builder_jobs')
    .select('closed_date')
    .not('closed_date', 'is', null);

  if (closedJobs) {
    const monthCounts = new Map<string, number>();
    for (const job of closedJobs) {
      const month = job.closed_date?.substring(0, 7);
      if (month) {
        monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
      }
    }

    const sorted = Array.from(monthCounts.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    for (const [month, count] of sorted.slice(0, 15)) {
      console.log(`  ${month}: ${count} jobs`);
    }
  }

  // Sample a few jobs to see what the data looks like
  console.log('\n\nSample jobs (newest by created_date):');
  const { data: sampleJobs } = await supabase
    .from('jobber_builder_jobs')
    .select('job_number, created_date, closed_date, total_revenue')
    .not('created_date', 'is', null)
    .order('created_date', { ascending: false })
    .limit(5);

  if (sampleJobs) {
    for (const job of sampleJobs) {
      console.log(`  Job #${job.job_number}: created ${job.created_date}, closed ${job.closed_date || 'NULL'}, revenue $${job.total_revenue}`);
    }
  }

  console.log('\n\nSample jobs (oldest by created_date):');
  const { data: oldJobs } = await supabase
    .from('jobber_builder_jobs')
    .select('job_number, created_date, closed_date, total_revenue')
    .not('created_date', 'is', null)
    .order('created_date', { ascending: true })
    .limit(5);

  if (oldJobs) {
    for (const job of oldJobs) {
      console.log(`  Job #${job.job_number}: created ${job.created_date}, closed ${job.closed_date || 'NULL'}, revenue $${job.total_revenue}`);
    }
  }
}

check().catch(console.error);
