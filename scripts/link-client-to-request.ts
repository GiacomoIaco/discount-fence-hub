import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Check for existing test client
  console.log('Looking for existing clients...');
  const { data: clients, error: e1 } = await supabase
    .from('clients')
    .select('id, name, company_name, city, state, zip')
    .limit(5);

  if (e1) {
    console.error('Error fetching clients:', e1.message);
    return;
  }

  console.log('Existing clients:');
  console.table(clients || []);

  let clientId: string;

  if (clients && clients.length > 0) {
    // Use first existing client
    clientId = clients[0].id;
    console.log(`\nUsing existing client: ${clients[0].name} (${clientId})`);
  } else {
    // Create a test client
    console.log('\nNo clients found, creating test client...');
    const { data: newClient, error: e2 } = await supabase
      .from('clients')
      .insert({
        name: 'John Smith Test',
        client_type: 'residential',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        primary_contact_phone: '512-555-1234'
      })
      .select()
      .single();

    if (e2) {
      console.error('Error creating client:', e2.message);
      return;
    }

    clientId = newClient.id;
    console.log(`Created test client: ${newClient.name} (${clientId})`);
  }

  // 2. Find the request we created
  console.log('\nLooking for request REQ-2026-0011...');
  const { data: request, error: e3 } = await supabase
    .from('service_requests')
    .select('id, request_number, customer_name, status, client_id')
    .eq('request_number', 'REQ-2026-0011')
    .single();

  if (e3) {
    console.error('Error finding request:', e3.message);
    // Try to find by customer name
    const { data: requests } = await supabase
      .from('service_requests')
      .select('id, request_number, customer_name, status, client_id')
      .ilike('customer_name', '%John Smith%')
      .order('created_at', { ascending: false })
      .limit(3);

    console.log('Found requests with John Smith:');
    console.table(requests || []);

    if (!requests || requests.length === 0) {
      console.error('No matching request found');
      return;
    }

    // Use most recent
    const targetRequest = requests[0];
    console.log(`\nUsing request: ${targetRequest.request_number}`);

    // Update it
    const { error: updateError } = await supabase
      .from('service_requests')
      .update({ client_id: clientId })
      .eq('id', targetRequest.id);

    if (updateError) {
      console.error('Error updating request:', updateError.message);
      return;
    }

    console.log(`\n✅ SUCCESS! Linked client ${clientId} to request ${targetRequest.request_number}`);
    return;
  }

  console.log('Found request:', request);

  if (request.client_id) {
    console.log(`Request already has client_id: ${request.client_id}`);
    return;
  }

  // 3. Update the request with client_id
  const { error: e4 } = await supabase
    .from('service_requests')
    .update({ client_id: clientId })
    .eq('id', request.id);

  if (e4) {
    console.error('Error updating request:', e4.message);
    return;
  }

  console.log(`\n✅ SUCCESS! Linked client ${clientId} to request ${request.request_number}`);
}

main().catch(console.error);
