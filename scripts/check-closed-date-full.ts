import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Full monthly distribution of closed_date:\n');

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

    // Sort chronologically (ascending)
    const sorted = Array.from(monthCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    console.log('Month\t\tJobs');
    console.log('------------------------');
    let total = 0;
    for (const [month, count] of sorted) {
      console.log(`${month}\t\t${count}`);
      total += count;
    }
    console.log('------------------------');
    console.log(`Total:\t\t${total}`);
  }
}

check().catch(console.error);
