import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function calc() {
  const { data, error } = await supabase
    .from('jobber_residential_opportunities')
    .select('days_to_quote')
    .not('days_to_quote', 'is', null)
    .order('days_to_quote', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }
  if (!data) return;

  const values = data.map(d => d.days_to_quote as number);
  const n = values.length;

  console.log('=== RAW DATA CHECK ===\n');
  console.log(`Total non-null records: ${n}`);
  console.log(`First 20 values: ${values.slice(0, 20).join(', ')}`);
  console.log(`Last 20 values: ${values.slice(-20).join(', ')}`);

  // Distribution
  const dist: Record<number, number> = {};
  for (const v of values) {
    dist[v] = (dist[v] || 0) + 1;
  }
  console.log('\nDistribution (days: count):');
  const sorted = Object.entries(dist).sort((a, b) => Number(a[0]) - Number(b[0]));
  for (const [days, count] of sorted.slice(0, 15)) {
    console.log(`  ${days} days: ${count}`);
  }
  if (sorted.length > 15) {
    console.log(`  ... and ${sorted.length - 15} more unique values`);
  }

  // Calculate percentiles properly
  const p90Index = Math.ceil(n * 0.90) - 1;
  const p90Value = values[p90Index];
  const p75Index = Math.ceil(n * 0.75) - 1;
  const p75Value = values[p75Index];

  console.log(`\nP75 index: ${p75Index}, value: ${p75Value}`);
  console.log(`P90 index: ${p90Index}, value: ${p90Value}`);

  // TM90: average of values at or below P90
  const tm90Values = values.slice(0, p90Index + 1);
  const tm90 = tm90Values.reduce((a, b) => a + b, 0) / tm90Values.length;

  // Also calculate TM90 by excluding top 10% (different approach)
  const excludeCount = Math.ceil(n * 0.10);
  const tm90ValuesAlt = values.slice(0, n - excludeCount);
  const tm90Alt = tm90ValuesAlt.reduce((a, b) => a + b, 0) / tm90ValuesAlt.length;

  // Compare metrics
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const median = values[Math.floor(n / 2)];

  console.log('\n=== METRICS COMPARISON ===\n');
  console.log(`  Mean (all data):     ${mean.toFixed(2)} days`);
  console.log(`  Median (P50):        ${median} days`);
  console.log(`  P75:                 ${p75Value} days`);
  console.log(`  P90:                 ${p90Value} days`);
  console.log(`  TM90 (<=P90):        ${tm90.toFixed(2)} days`);
  console.log(`  TM90 (excl top 10%): ${tm90Alt.toFixed(2)} days`);
}

calc().catch(console.error);
