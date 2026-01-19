import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Count opportunities
  const { count } = await supabase
    .from('jobber_api_opportunities')
    .select('*', { count: 'exact', head: true });
  console.log('Total opportunities:', count);

  // Count with salesperson
  const { count: spCount } = await supabase
    .from('jobber_api_opportunities')
    .select('*', { count: 'exact', head: true })
    .not('salesperson', 'is', null);
  console.log('With salesperson:', spCount);

  // Calculate coverage
  if (count && spCount) {
    console.log('Coverage:', ((spCount / count) * 100).toFixed(1) + '%');
  }

  // Salesperson distribution - use pagination to get all records
  let allOpps: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data: opps } = await supabase
      .from('jobber_api_opportunities')
      .select('salesperson')
      .not('salesperson', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!opps || opps.length === 0) break;
    allOpps = allOpps.concat(opps);
    if (opps.length < pageSize) break;
    page++;
  }

  const counts: Record<string, number> = {};
  allOpps.forEach((o) => { counts[o.salesperson] = (counts[o.salesperson] || 0) + 1; });

  console.log('\nSalesperson distribution in opportunities (' + allOpps.length + ' total):');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log(`  ${name}: ${count}`);
  });
}

check();
