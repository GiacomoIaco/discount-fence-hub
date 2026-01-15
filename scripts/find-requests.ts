import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // Get most recent requests
  console.log('RECENT REQUESTS:');
  const { data: requests, error } = await supabase
    .from('service_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (requests && requests.length > 0) {
    // Show columns
    console.log('Columns:', Object.keys(requests[0]));
    console.log('\n');

    // Show each request
    requests.forEach((r, i) => {
      console.log(`--- Request ${i + 1} ---`);
      console.log(`  ID: ${r.id}`);
      console.log(`  Number: ${r.request_number}`);
      console.log(`  Name: ${r.name || r.contact_name || 'N/A'}`);
      console.log(`  Status: ${r.status}`);
      console.log(`  Client ID: ${r.client_id || 'NULL'}`);
      console.log(`  Address: ${r.address_line1}, ${r.city}, ${r.state} ${r.zip}`);
      console.log(`  Created: ${r.created_at}`);
    });
  } else {
    console.log('No requests found');
  }
}

main().catch(console.error);
