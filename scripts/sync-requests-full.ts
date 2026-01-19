/**
 * Full Requests Sync - No page limit
 * Phase 1 of API Sync Implementation Plan
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
// Reduced from 50 to 35 because query cost (~219 per record) * 50 = 10,955 > 10,000 max
const PAGE_SIZE = 35;
const SYNC_CUTOFF_DATE = '2024-01-01T00:00:00Z';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Refresh Jobber access token
 */
async function refreshToken(refreshTokenValue: string): Promise<string> {
  console.log('Refreshing token...');

  const response = await fetch(JOBBER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
      client_id: process.env.JOBBER_CLIENT_ID!,
      client_secret: process.env.JOBBER_CLIENT_SECRET!,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const token = await response.json();

  // Update stored tokens
  const now = new Date();
  const expiresIn = token.expires_in || 3600;
  const accessTokenExpiresAt = new Date(now.getTime() + expiresIn * 1000);

  await supabase
    .from('jobber_tokens')
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token || refreshTokenValue,
      access_token_expires_at: accessTokenExpiresAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', 'residential');

  console.log(`Token refreshed, valid until ${accessTokenExpiresAt.toISOString()}`);
  return token.access_token;
}

/**
 * Get valid access token (refreshing if expired)
 */
async function getAccessToken(): Promise<string> {
  const { data: tokenData } = await supabase
    .from('jobber_tokens')
    .select('*')
    .eq('id', 'residential')
    .single();

  if (!tokenData) {
    throw new Error('No token found for residential');
  }

  const expiresAt = new Date(tokenData.access_token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt < fiveMinutesFromNow) {
    console.log(`Token ${expiresAt < now ? 'expired' : 'expiring soon'}, refreshing...`);
    return refreshToken(tokenData.refresh_token);
  }

  console.log(`Token valid until ${expiresAt.toISOString()}`);
  return tokenData.access_token;
}

async function syncAllRequests() {
  console.log('=== FULL REQUESTS SYNC ===');
  console.log('Starting at:', new Date().toISOString());
  console.log('Sync cutoff:', SYNC_CUTOFF_DATE);
  console.log('');

  // Get valid token (refreshing if needed)
  const accessToken = await getAccessToken();
  let cursor: string | null = null;
  let hasMore = true;
  let totalItems = 0;
  let pageNum = 0;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 10;

  const startTime = Date.now();

  while (hasMore) {
    pageNum++;

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

    try {
      const response = await fetch(JOBBER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION || '2025-01-20',
        },
        body: JSON.stringify({ query }),
      });

      console.log(`Response status: ${response.status}`);
      const result = await response.json();

      // Log cost info
      const cost = result.extensions?.cost;
      if (cost) {
        console.log(`Query cost - Requested: ${cost.requestedQueryCost}, Actual: ${cost.actualQueryCost}, Available: ${cost.throttleStatus?.currentlyAvailable}`);
      }

      if (result.errors) {
        const errorMsg = result.errors[0]?.message || 'Unknown error';
        const errorCode = result.errors[0]?.extensions?.code;

        // Log full error details on first occurrence
        if (consecutiveErrors === 0) {
          console.log('Full error response:', JSON.stringify(result.errors, null, 2));
        }

        const isThrottled = result.errors.some((e: any) =>
          e.message?.toLowerCase().includes('throttl') ||
          e.extensions?.code === 'THROTTLED'
        );

        if (isThrottled) {
          consecutiveErrors++;
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error(`\nToo many consecutive throttle errors (${consecutiveErrors}). Stopping.`);
            break;
          }
          // Log full error and extensions for debugging
          const throttleInfo = result.extensions?.cost?.throttleStatus;
          console.log(`Throttle info: ${JSON.stringify(throttleInfo)} | Error code: ${errorCode}`);

          // Wait based on available points (at 500/sec restore)
          let waitTime = 60000; // Default 60s
          if (throttleInfo?.currentlyAvailable !== undefined) {
            const pointsNeeded = 2000; // Conservative estimate per query
            const restoreRate = throttleInfo.restoreRate || 500;
            if (throttleInfo.currentlyAvailable < pointsNeeded) {
              waitTime = Math.ceil(((pointsNeeded - throttleInfo.currentlyAvailable) / restoreRate) * 1000) + 5000;
            }
          }
          console.log(`Throttled: "${errorMsg}" (${consecutiveErrors}/${maxConsecutiveErrors}). Waiting ${waitTime/1000}s...`);
          await sleep(waitTime);
          pageNum--; // Retry same page
          continue;
        }

        console.error('GraphQL error:', JSON.stringify(result.errors, null, 2));
        break;
      }

      // Check if we got valid data
      if (!result.data || !result.data.requests) {
        console.error('\nUnexpected response (no data.requests):', JSON.stringify(result, null, 2).slice(0, 500));
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutiveErrors) break;
        await sleep(30000);
        pageNum--;
        continue;
      }

      consecutiveErrors = 0; // Reset on success
      const { nodes, pageInfo } = result.data.requests;

      // Log progress with rate limit info
      const available = result.extensions?.cost?.throttleStatus?.currentlyAvailable;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      process.stdout.write(`\rPage ${pageNum}: ${totalItems + nodes.length} requests | ${elapsed}s | Points: ${available || '?'}/10000    `);

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

        if (error) console.error('\nDB error:', error.message);
        totalItems += nodes.length;
      }

      hasMore = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;

      // Adaptive delay based on available points
      if (hasMore) {
        let delay = 3000; // Default 3s
        if (available !== undefined) {
          if (available < 3000) delay = 8000;
          else if (available < 5000) delay = 5000;
          else if (available > 8000) delay = 2000;
        }
        await sleep(delay);
      }

    } catch (error) {
      console.error('\nFetch error:', error);
      consecutiveErrors++;
      if (consecutiveErrors >= maxConsecutiveErrors) break;
      await sleep(30000);
      pageNum--;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n=== SYNC COMPLETE ===`);
  console.log(`Total requests synced: ${totalItems}`);
  console.log(`Pages fetched: ${pageNum}`);
  console.log(`Duration: ${duration}s`);

  // Show salesperson distribution
  const { data: requests } = await supabase
    .from('jobber_api_requests')
    .select('salesperson')
    .not('salesperson', 'is', null);

  const counts: Record<string, number> = {};
  requests?.forEach((r) => { counts[r.salesperson] = (counts[r.salesperson] || 0) + 1; });

  console.log('\nSalesperson distribution:');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([name, count]) => {
    console.log(`  ${name}: ${count}`);
  });

  // Update sync status
  await supabase.from('jobber_sync_status').update({
    requests_synced: totalItems,
    updated_at: new Date().toISOString(),
  }).eq('id', 'residential');

  console.log('\nSync status updated.');
}

syncAllRequests().catch(console.error);
