import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncRequests() {
  const { data: tokenData } = await supabase
    .from('jobber_tokens')
    .select('access_token')
    .eq('id', 'residential')
    .single();

  if (!tokenData) {
    console.error('No token found');
    return;
  }

  const accessToken = tokenData.access_token;
  let cursor: string | null = null;
  let hasMore = true;
  let totalItems = 0;
  let pageNum = 0;

  // Use smaller page size and longer delays
  const pageSize = 20;
  const delay = 5000;

  while (hasMore && pageNum < 100) { // Max 100 pages = 2000 items
    pageNum++;

    const query = `
      query SyncRequests {
        requests(
          first: ${pageSize}
          ${cursor ? `after: "${cursor}"` : ''}
          filter: { createdAt: { after: "2024-01-01T00:00:00Z" } }
        ) {
          nodes {
            id
            title
            requestStatus
            source
            createdAt
            client { id name }
            property { address { street city province postalCode } }
            assessment {
              startAt
              completedAt
              assignedUsers { nodes { name { full } } }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    console.log(`Fetching page ${pageNum} (${totalItems} synced so far)...`);

    const response = await fetch(JOBBER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION || '2025-01-20',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error('Error on page', pageNum, ':', result.errors[0]?.message);

      if (result.errors[0]?.extensions?.code === 'THROTTLED') {
        console.log('Throttled - waiting 30 seconds...');
        await sleep(30000);
        pageNum--; // Retry same page
        continue;
      }
      break;
    }

    const { nodes, pageInfo } = result.data.requests;

    // Log cost info
    if (result.extensions?.cost) {
      console.log(`  Available: ${result.extensions.cost.throttleStatus?.currentlyAvailable}/${result.extensions.cost.throttleStatus?.maximumAvailable}`);
    }

    if (nodes.length > 0) {
      const records = nodes.map((r: any) => ({
        jobber_id: r.id,
        title: r.title,
        status: r.requestStatus?.toLowerCase(),
        lead_source: r.source || null,
        created_at_jobber: r.createdAt || null,
        salesperson: r.assessment?.assignedUsers?.nodes?.[0]?.name?.full || null,
        client_jobber_id: r.client?.id,
        client_name: r.client?.name,
        service_street: r.property?.address?.street,
        service_city: r.property?.address?.city,
        service_state: r.property?.address?.province,
        service_zip: r.property?.address?.postalCode,
        assessment_start_at: r.assessment?.startAt,
        assessment_completed_at: r.assessment?.completedAt,
        synced_at: new Date().toISOString(),
        raw_data: r,
      }));

      const { error } = await supabase
        .from('jobber_api_requests')
        .upsert(records, { onConflict: 'jobber_id' });

      if (error) console.error('DB error:', error.message);
      totalItems += nodes.length;
    }

    hasMore = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    if (hasMore) await sleep(delay);
  }

  console.log(`\nDone! Synced ${totalItems} requests in ${pageNum} pages`);

  // Show salesperson distribution
  const { data: requests } = await supabase
    .from('jobber_api_requests')
    .select('salesperson')
    .not('salesperson', 'is', null);

  const counts: Record<string, number> = {};
  requests?.forEach((r) => { counts[r.salesperson] = (counts[r.salesperson] || 0) + 1; });

  console.log('\nSalesperson distribution:');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log(`  ${name}: ${count}`);
  });
}

syncRequests().catch(console.error);
