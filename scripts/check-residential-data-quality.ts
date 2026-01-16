// Check Residential Data Quality
// Run: npx ts-node scripts/check-residential-data-quality.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkDataQuality() {
  console.log('\n📊 RESIDENTIAL DATA QUALITY REPORT\n');
  console.log('='.repeat(60));

  // 1. Total opportunities
  const { count: totalOpps } = await supabase
    .from('jobber_residential_opportunities')
    .select('*', { count: 'exact', head: true });

  console.log(`\n1️⃣  TOTAL OPPORTUNITIES: ${totalOpps?.toLocaleString()}`);

  // 2. Conversion breakdown
  const { data: conversionStats } = await supabase.rpc('get_residential_funnel_metrics', {
    p_start_date: null,
    p_end_date: null,
    p_salesperson: null,
    p_revenue_bucket: null,
    p_speed_bucket: null,
  });

  if (conversionStats) {
    const stats = Array.isArray(conversionStats) ? conversionStats[0] : conversionStats;
    console.log(`\n2️⃣  CONVERSION STATUS:`);
    console.log(`    Won:     ${stats.won_opportunities.toLocaleString()} (${((stats.won_opportunities / stats.total_opportunities) * 100).toFixed(1)}%)`);
    console.log(`    Lost:    ${stats.lost_opportunities.toLocaleString()} (${((stats.lost_opportunities / stats.total_opportunities) * 100).toFixed(1)}%)`);
    console.log(`    Pending: ${stats.pending_opportunities.toLocaleString()} (${((stats.pending_opportunities / stats.total_opportunities) * 100).toFixed(1)}%)`);
    console.log(`\n    Win Rate (count): ${stats.win_rate?.toFixed(1)}%`);
    console.log(`    Value Win Rate:   ${stats.value_win_rate?.toFixed(1)}%`);
    console.log(`    Won Value:        $${(stats.won_value / 1000000).toFixed(2)}M`);
    console.log(`    Pipeline Value:   $${(stats.total_value / 1000000).toFixed(2)}M`);
  }

  // 3. Assessment date linkage (Requests)
  const { count: withAssessment } = await supabase
    .from('jobber_residential_opportunities')
    .select('*', { count: 'exact', head: true })
    .not('assessment_date', 'is', null);

  const assessmentPct = totalOpps ? ((withAssessment || 0) / totalOpps * 100).toFixed(1) : '0';
  console.log(`\n3️⃣  REQUEST LINKAGE (Assessment Dates):`);
  console.log(`    With assessment_date: ${withAssessment?.toLocaleString()} (${assessmentPct}%)`);
  console.log(`    Missing:              ${((totalOpps || 0) - (withAssessment || 0)).toLocaleString()}`);

  // 4. Days to Quote distribution (only where linked)
  const { data: speedData } = await supabase.rpc('get_residential_speed_metrics', {
    p_start_date: null,
    p_end_date: null,
    p_salesperson: null,
    p_revenue_bucket: null,
  });

  if (speedData && speedData.length > 0) {
    console.log(`\n4️⃣  SPEED TO QUOTE DISTRIBUTION (where data exists):`);
    for (const bucket of speedData) {
      console.log(`    ${bucket.speed_bucket.padEnd(12)}: ${bucket.total_opps.toLocaleString().padStart(5)} opps → ${bucket.win_rate?.toFixed(1)}% win rate`);
    }
  }

  // 5. Job linkage (for Won opportunities)
  const { count: wonOpps } = await supabase
    .from('jobber_residential_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('is_won', true);

  const { count: wonWithScheduled } = await supabase
    .from('jobber_residential_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('is_won', true)
    .not('scheduled_date', 'is', null);

  const { count: wonWithClosed } = await supabase
    .from('jobber_residential_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('is_won', true)
    .not('closed_date', 'is', null);

  const schedulePct = wonOpps ? ((wonWithScheduled || 0) / wonOpps * 100).toFixed(1) : '0';
  const closePct = wonOpps ? ((wonWithClosed || 0) / wonOpps * 100).toFixed(1) : '0';

  console.log(`\n5️⃣  JOB LINKAGE (Won Opportunities):`);
  console.log(`    Won opportunities:     ${wonOpps?.toLocaleString()}`);
  console.log(`    With scheduled_date:   ${wonWithScheduled?.toLocaleString()} (${schedulePct}%)`);
  console.log(`    With closed_date:      ${wonWithClosed?.toLocaleString()} (${closePct}%)`);

  // 6. $0 Revenue Jobs (Potential Warranties)
  const { count: zeroRevenueJobs } = await supabase
    .from('jobber_residential_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('total_revenue', 0);

  const { count: totalJobs } = await supabase
    .from('jobber_residential_jobs')
    .select('*', { count: 'exact', head: true });

  console.log(`\n6️⃣  $0 REVENUE JOBS (Potential Warranties):`);
  console.log(`    Total jobs:     ${totalJobs?.toLocaleString()}`);
  console.log(`    $0 revenue:     ${zeroRevenueJobs?.toLocaleString()}`);

  // 7. Quote count distribution
  const { data: quoteCountData } = await supabase.rpc('get_residential_quote_count_metrics', {
    p_start_date: null,
    p_end_date: null,
    p_revenue_bucket: null,
  });

  if (quoteCountData && quoteCountData.length > 0) {
    console.log(`\n7️⃣  QUOTE COUNT DISTRIBUTION (# quotes per opportunity):`);
    for (const bucket of quoteCountData) {
      console.log(`    ${bucket.quote_count_bucket.padEnd(10)}: ${bucket.total_opps.toLocaleString().padStart(5)} opps → ${bucket.win_rate?.toFixed(1)}% win rate`);
    }
  }

  // 8. Cycle time averages (for won opps with data)
  const { data: cycleData } = await supabase
    .from('jobber_residential_opportunities')
    .select('days_to_quote, days_to_decision, days_to_close')
    .eq('is_won', true)
    .not('days_to_quote', 'is', null);

  if (cycleData && cycleData.length > 0) {
    const avgDaysToQuote = cycleData.reduce((a, b) => a + (b.days_to_quote || 0), 0) / cycleData.length;
    const withDecision = cycleData.filter(d => d.days_to_decision !== null);
    const avgDaysToDecision = withDecision.length > 0
      ? withDecision.reduce((a, b) => a + (b.days_to_decision || 0), 0) / withDecision.length
      : null;
    const withClose = cycleData.filter(d => d.days_to_close !== null);
    const avgDaysToClose = withClose.length > 0
      ? withClose.reduce((a, b) => a + (b.days_to_close || 0), 0) / withClose.length
      : null;

    console.log(`\n8️⃣  CYCLE TIME AVERAGES (Won opps with data):`);
    console.log(`    Avg Days to Quote:    ${avgDaysToQuote.toFixed(1)} days (n=${cycleData.length})`);
    console.log(`    Avg Days to Decision: ${avgDaysToDecision?.toFixed(1) || 'N/A'} days (n=${withDecision.length})`);
    console.log(`    Avg Days to Close:    ${avgDaysToClose?.toFixed(1) || 'N/A'} days (n=${withClose.length})`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('END OF REPORT\n');
}

checkDataQuality().catch(console.error);
