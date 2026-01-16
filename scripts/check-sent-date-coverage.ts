// Check sent_date coverage
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('\n📊 QUOTE DATE COVERAGE ANALYSIS\n');
  console.log('='.repeat(60));

  // Check sent_date coverage in quotes
  const { count: totalQuotes } = await supabase
    .from('jobber_residential_quotes')
    .select('*', { count: 'exact', head: true });

  const { count: withSentDate } = await supabase
    .from('jobber_residential_quotes')
    .select('*', { count: 'exact', head: true })
    .not('sent_date', 'is', null);

  const { count: withDraftedDate } = await supabase
    .from('jobber_residential_quotes')
    .select('*', { count: 'exact', head: true })
    .not('drafted_date', 'is', null);

  console.log('\n1️⃣  QUOTE DATE FIELDS:');
  console.log(`    Total quotes:      ${totalQuotes?.toLocaleString()}`);
  console.log(`    With drafted_date: ${withDraftedDate?.toLocaleString()} (${((withDraftedDate||0)/(totalQuotes||1)*100).toFixed(1)}%)`);
  console.log(`    With sent_date:    ${withSentDate?.toLocaleString()} (${((withSentDate||0)/(totalQuotes||1)*100).toFixed(1)}%)`);

  // Check won quotes for converted_date
  const { count: convertedQuotes } = await supabase
    .from('jobber_residential_quotes')
    .select('*', { count: 'exact', head: true })
    .eq('is_converted', true);

  const { count: convertedWithDate } = await supabase
    .from('jobber_residential_quotes')
    .select('*', { count: 'exact', head: true })
    .eq('is_converted', true)
    .not('converted_date', 'is', null);

  console.log('\n2️⃣  CONVERTED QUOTE COVERAGE:');
  console.log(`    Total converted:      ${convertedQuotes?.toLocaleString()}`);
  console.log(`    With converted_date:  ${convertedWithDate?.toLocaleString()} (${((convertedWithDate||0)/(convertedQuotes||1)*100).toFixed(1)}%)`);

  // Sample to see date differences
  const { data: samples } = await supabase
    .from('jobber_residential_quotes')
    .select('quote_number, drafted_date, sent_date, converted_date, status, total')
    .not('sent_date', 'is', null)
    .order('quote_number', { ascending: false })
    .limit(10);

  console.log('\n3️⃣  SAMPLE QUOTES (recent with sent_date):');
  console.log('    Quote#   | Drafted      | Sent         | Gap  | Status');
  console.log('    ' + '-'.repeat(60));
  for (const s of samples || []) {
    const draftToSent = s.drafted_date && s.sent_date ?
      Math.round((new Date(s.sent_date).getTime() - new Date(s.drafted_date).getTime()) / (1000*60*60*24)) : null;
    const gap = draftToSent !== null ? `${draftToSent}d`.padStart(4) : 'N/A ';
    console.log(`    ${String(s.quote_number).padEnd(8)} | ${(s.drafted_date || 'N/A').padEnd(12)} | ${(s.sent_date || 'N/A').padEnd(12)} | ${gap} | ${s.status}`);
  }

  // Average gap between draft and sent
  const { data: gapData } = await supabase
    .from('jobber_residential_quotes')
    .select('drafted_date, sent_date')
    .not('drafted_date', 'is', null)
    .not('sent_date', 'is', null);

  if (gapData && gapData.length > 0) {
    let totalGap = 0;
    let sameDay = 0;
    for (const row of gapData) {
      const gap = Math.round((new Date(row.sent_date).getTime() - new Date(row.drafted_date).getTime()) / (1000*60*60*24));
      totalGap += gap;
      if (gap === 0) sameDay++;
    }
    const avgGap = totalGap / gapData.length;
    console.log(`\n4️⃣  DRAFT → SENT GAP ANALYSIS (n=${gapData.length}):`);
    console.log(`    Average gap:     ${avgGap.toFixed(1)} days`);
    console.log(`    Same day send:   ${sameDay.toLocaleString()} (${(sameDay/gapData.length*100).toFixed(1)}%)`);
  }

  // Check approved_date coverage
  const { count: withApprovedDate } = await supabase
    .from('jobber_residential_quotes')
    .select('*', { count: 'exact', head: true })
    .not('approved_date', 'is', null);

  console.log(`\n5️⃣  APPROVED DATE COVERAGE:`);
  console.log(`    With approved_date: ${withApprovedDate?.toLocaleString()} (${((withApprovedDate||0)/(totalQuotes||1)*100).toFixed(1)}%)`);

  console.log('\n' + '='.repeat(60));
}

check().catch(console.error);
