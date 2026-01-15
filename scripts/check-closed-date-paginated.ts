import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Full monthly distribution of closed_date (with pagination):\n');

  const monthCounts = new Map<string, number>();
  let offset = 0;
  const pageSize = 1000;
  let total = 0;

  while (true) {
    const { data: closedJobs, error } = await supabase
      .from('jobber_builder_jobs')
      .select('closed_date')
      .not('closed_date', 'is', null)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.log('Error:', error.message);
      break;
    }

    if (!closedJobs || closedJobs.length === 0) {
      break;
    }

    for (const job of closedJobs) {
      const month = job.closed_date?.substring(0, 7);
      if (month) {
        monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
        total++;
      }
    }

    console.log(`Fetched ${offset} - ${offset + closedJobs.length}...`);

    if (closedJobs.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  // Sort chronologically (ascending)
  const sorted = Array.from(monthCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  console.log('\n\nMonth\t\tJobs');
  console.log('------------------------');
  for (const [month, count] of sorted) {
    console.log(`${month}\t\t${count}`);
  }
  console.log('------------------------');
  console.log(`Total:\t\t${total}`);
}

check().catch(console.error);
