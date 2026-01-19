import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';
const PAGE_SIZE = 50;
const SYNC_CUTOFF_DATE = '2024-01-01T00:00:00Z';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncRequests() {
  // Get token
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
  let retries = 0;
  const maxRetries = 5;

  while (hasMore) {
    pageNum++;
    console.log(`Fetching page ${pageNum}...`);

    const query = `
      query SyncRequests {
        requests(
          first: ${PAGE_SIZE}
          ${cursor ? `after: "${cursor}"` : ''}
          filter: { createdAt: { after: "${SYNC_CUTOFF_DATE}" } }
        ) {
          nodes {
            id
            title
            requestStatus
            source
            createdAt
            client {
              id
              name
            }
            property {
              address {
                street
                city
                province
                postalCode
              }
            }
            assessment {
              startAt
              completedAt
              assignedUsers {
                nodes {
                  name {
                    full
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

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
      const isThrottled = result.errors.some((e: any) =>
        e.message?.toLowerCase().includes('throttl') ||
        e.extensions?.code === 'THROTTLED'
      );

      if (isThrottled && retries < maxRetries) {
        retries++;
        const waitTime = 5000 * Math.pow(2, retries);
        console.log(`Throttled. Waiting ${waitTime}ms before retry ${retries}/${maxRetries}...`);
        await sleep(waitTime);
        pageNum--; // Retry same page
        continue;
      }

      console.error('GraphQL errors:', JSON.stringify(result.errors, null, 2));
      break;
    }

    retries = 0; // Reset on success

    const { nodes, pageInfo } = result.data.requests;

    if (nodes.length > 0) {
      const records = nodes.map((r: any) => {
        const addr = r.property?.address;
        const salesperson = r.assessment?.assignedUsers?.nodes?.[0]?.name?.full || null;

        return {
          jobber_id: r.id,
          title: r.title,
          status: r.requestStatus?.toLowerCase().replace(/_/g, '_'),
          lead_source: r.source || null,
          created_at_jobber: r.createdAt || null,
          salesperson,
          client_jobber_id: r.client?.id,
          client_name: r.client?.name,
          service_street: addr?.street,
          service_city: addr?.city,
          service_state: addr?.province,
          service_zip: addr?.postalCode,
          assessment_start_at: r.assessment?.startAt,
          assessment_completed_at: r.assessment?.completedAt,
          synced_at: new Date().toISOString(),
          raw_data: r,
        };
      });

      const { error } = await supabase
        .from('jobber_api_requests')
        .upsert(records, { onConflict: 'jobber_id' });

      if (error) {
        console.error('Error upserting:', error);
      }

      totalItems += nodes.length;
      console.log(`Page ${pageNum}: ${nodes.length} requests (total: ${totalItems})`);
    }

    hasMore = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    // Rate limiting
    if (hasMore) {
      await sleep(3000);
    }
  }

  console.log(`\nDone! Synced ${totalItems} requests`);

  // Show salesperson distribution
  const { data: salespeople } = await supabase
    .from('jobber_api_requests')
    .select('salesperson')
    .not('salesperson', 'is', null);

  const counts: Record<string, number> = {};
  salespeople?.forEach((r) => {
    counts[r.salesperson] = (counts[r.salesperson] || 0) + 1;
  });

  console.log('\nSalesperson distribution:');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      console.log(`  ${name}: ${count}`);
    });
}

syncRequests().catch(console.error);
