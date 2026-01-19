import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';

async function test() {
  const { data: tokenData } = await supabase
    .from('jobber_tokens')
    .select('access_token')
    .eq('id', 'residential')
    .single();

  console.log('Making simple test query...');

  // Simple account query (like the test endpoint uses)
  const query = `query TestConnection { account { name } }`;

  const response = await fetch(JOBBER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenData!.access_token}`,
      'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION || '2025-01-20',
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();
  console.log('Response:', JSON.stringify(result, null, 2));

  if (result.extensions?.cost) {
    console.log('\nCost info:');
    console.log('  Available:', result.extensions.cost.throttleStatus?.currentlyAvailable);
    console.log('  Max:', result.extensions.cost.throttleStatus?.maximumAvailable);
    console.log('  Restore rate:', result.extensions.cost.throttleStatus?.restoreRate);
  }
}

test().catch(console.error);
