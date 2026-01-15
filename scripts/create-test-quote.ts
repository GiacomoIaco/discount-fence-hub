import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function createTestQuote() {
  console.log('Creating test quote for manager approval workflow...\n');

  // First, find or create a test client
  let clientId: string;

  const { data: existingClient } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%test%')
    .limit(1)
    .single();

  if (existingClient) {
    clientId = existingClient.id;
    console.log(`Using existing client: ${existingClient.name} (${clientId})`);
  } else {
    // Create a test client
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: 'Manager Approval Test Client',
        client_type: 'homeowner',
        business_unit: 'Residential',
      })
      .select()
      .single();

    if (clientError) {
      console.error('Error creating client:', clientError);
      return;
    }
    clientId = newClient.id;
    console.log(`Created new client: ${newClient.name} (${clientId})`);
  }

  // Create a quote with low margin to trigger approval requirement
  // Margin < 15% triggers approval
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      client_id: clientId,
      status: 'draft',
      subtotal: 1000,
      total: 1000,
      // Set margin to 10% (below 15% threshold)
      margin_percent: 10,
      discount_percent: 0,
      tax_rate: 8.25,
      payment_terms: 'Net 30',
    })
    .select()
    .single();

  if (quoteError) {
    console.error('Error creating quote:', quoteError);
    return;
  }

  console.log(`\n✅ Created test quote: ${quote.quote_number}`);
  console.log(`   ID: ${quote.id}`);
  console.log(`   Status: ${quote.status}`);
  console.log(`   Total: $${quote.total}`);
  console.log(`   Margin: ${quote.margin_percent}% (below 15% threshold - needs approval)`);
  console.log(`\n📋 Open this quote at:`);
  console.log(`   https://discount-fence-hub.netlify.app/quotes/${quote.id}`);
}

createTestQuote();
