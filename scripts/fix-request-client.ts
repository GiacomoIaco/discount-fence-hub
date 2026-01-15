import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const requestId = '02bd0f06-c194-4e61-9931-94dea1f92ef5';

  // Create a test residential client
  console.log('Creating test client...');
  const { data: client, error: e1 } = await supabase
    .from('clients')
    .insert({
      name: 'John Smith Test',
      client_type: 'residential',
      business_unit: 'residential',  // Required field
      address_line1: '100 Congress Ave',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      primary_contact_phone: '512-555-1234'
    })
    .select()
    .single();

  if (e1) {
    console.error('Error creating client:', e1.message);
    return;
  }

  console.log(`Created client: ${client.name} (${client.id})`);

  // Link to request
  console.log('\nLinking client to request...');
  const { error: e2 } = await supabase
    .from('service_requests')
    .update({ client_id: client.id })
    .eq('id', requestId);

  if (e2) {
    console.error('Error updating request:', e2.message);
    return;
  }

  console.log('✅ SUCCESS! Client linked to request REQ-2026-0011');

  // Verify
  const { data: request } = await supabase
    .from('service_requests')
    .select('request_number, client_id, status')
    .eq('id', requestId)
    .single();

  console.log('\nVerification:', request);
}

main().catch(console.error);
