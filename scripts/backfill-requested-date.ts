import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfill() {
  console.log('=== BACKFILLING REQUESTED_DATE ===\n');

  // Get all requests with quote links
  const { data: requests, error: reqError } = await supabase
    .from('jobber_residential_requests')
    .select('quote_numbers, requested_date')
    .not('quote_numbers', 'is', null)
    .not('requested_date', 'is', null);

  if (reqError) {
    console.error('Error fetching requests:', reqError);
    return;
  }

  console.log(`Found ${requests.length} requests with quote links`);

  // Build a map: quote_number -> earliest requested_date
  const requestedDateByQuote = new Map<number, string>();

  for (const req of requests) {
    const quoteNums = req.quote_numbers.split(',').map((n: string) => parseInt(n.trim(), 10)).filter((n: number) => !isNaN(n));
    for (const qn of quoteNums) {
      const existing = requestedDateByQuote.get(qn);
      if (!existing || req.requested_date < existing) {
        requestedDateByQuote.set(qn, req.requested_date);
      }
    }
  }

  console.log(`Built lookup with ${requestedDateByQuote.size} quote -> date mappings`);

  // Get all quotes to find opportunity_key for each quote
  const { data: quotes, error: quoteError } = await supabase
    .from('jobber_residential_quotes')
    .select('quote_number, opportunity_key');

  if (quoteError) {
    console.error('Error fetching quotes:', quoteError);
    return;
  }

  // Build: opportunity_key -> earliest requested_date
  const requestedDateByOpp = new Map<string, string>();

  for (const quote of quotes) {
    const reqDate = requestedDateByQuote.get(quote.quote_number);
    if (reqDate) {
      const existing = requestedDateByOpp.get(quote.opportunity_key);
      if (!existing || reqDate < existing) {
        requestedDateByOpp.set(quote.opportunity_key, reqDate);
      }
    }
  }

  console.log(`Found ${requestedDateByOpp.size} opportunities to update`);

  // Update opportunities in batches
  const entries = Array.from(requestedDateByOpp.entries());
  let updated = 0;
  const batchSize = 100;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);

    for (const [oppKey, requestedDate] of batch) {
      const { error } = await supabase
        .from('jobber_residential_opportunities')
        .update({ requested_date: requestedDate })
        .eq('opportunity_key', oppKey)
        .is('requested_date', null);

      if (error) {
        console.error(`Error updating ${oppKey}:`, error.message);
      } else {
        updated++;
      }
    }

    console.log(`Progress: ${Math.min(i + batchSize, entries.length)}/${entries.length}`);
  }

  console.log(`\n✅ Updated ${updated} opportunities with requested_date`);

  // Verify the results
  const { data: verify } = await supabase
    .from('jobber_residential_opportunities')
    .select('days_to_quote')
    .not('days_to_quote', 'is', null);

  if (verify) {
    const dist: Record<string, number> = {
      'Same day (0)': 0,
      '1-3 days': 0,
      '4-7 days': 0,
      '8+ days': 0,
    };

    for (const o of verify) {
      if (o.days_to_quote === 0) dist['Same day (0)']++;
      else if (o.days_to_quote <= 3) dist['1-3 days']++;
      else if (o.days_to_quote <= 7) dist['4-7 days']++;
      else dist['8+ days']++;
    }

    console.log('\n=== UPDATED DISTRIBUTION ===');
    console.log(`Total with days_to_quote: ${verify.length}`);
    for (const [bucket, count] of Object.entries(dist)) {
      console.log(`  ${bucket}: ${count}`);
    }
  }
}

backfill().catch(console.error);
