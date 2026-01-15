import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Get count with closed_date
  const { count: withClosed } = await supabase
    .from('jobber_builder_jobs')
    .select('id', { count: 'exact', head: true })
    .not('closed_date', 'is', null);

  console.log(`Count of jobs with closed_date NOT NULL: ${withClosed}`);

  // Sample some jobs with closed_date
  const { data: sample } = await supabase
    .from('jobber_builder_jobs')
    .select('job_number, closed_date')
    .not('closed_date', 'is', null)
    .limit(20);

  console.log('\nSample closed_date values:');
  if (sample) {
    for (const job of sample) {
      console.log(`  Job #${job.job_number}: "${job.closed_date}" (type: ${typeof job.closed_date})`);
    }
  }

  // Check for any unusual closed_date values
  console.log('\n\nChecking for year distribution in closed_date:');
  const { data: allClosed } = await supabase
    .from('jobber_builder_jobs')
    .select('closed_date')
    .not('closed_date', 'is', null);

  if (allClosed) {
    const yearCounts = new Map<string, number>();
    const invalidDates: string[] = [];

    for (const job of allClosed) {
      if (!job.closed_date) {
        continue;
      }
      const year = job.closed_date.substring(0, 4);
      if (year && /^\d{4}$/.test(year)) {
        yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
      } else {
        if (invalidDates.length < 10) {
          invalidDates.push(job.closed_date);
        }
      }
    }

    console.log('\nBy year:');
    for (const [year, count] of yearCounts.entries()) {
      console.log(`  ${year}: ${count}`);
    }

    if (invalidDates.length > 0) {
      console.log(`\nInvalid dates found: ${invalidDates.join(', ')}`);
    }

    console.log(`\nTotal parsed: ${allClosed.length}`);
    console.log(`Total year counts: ${Array.from(yearCounts.values()).reduce((a,b) => a+b, 0)}`);
  }
}

check().catch(console.error);
