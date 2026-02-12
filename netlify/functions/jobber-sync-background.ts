import type { BackgroundHandler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
const PAGE_SIZE = 50;

// Only sync data from 2024 onwards - no need for older historical data
const SYNC_CUTOFF_DATE = '2024-01-01T00:00:00Z';

// Buffer to avoid missing records modified during previous sync window
const SYNC_BUFFER_MINUTES = 5;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

type JobberAccount = 'residential' | 'builders' | 'commercial';
type SyncMode = 'full' | 'incremental';

interface SyncConfig {
  mode: SyncMode;
  syncSince?: string; // ISO timestamp for incremental
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine the sync mode based on last sync status
 */
async function determineSyncMode(account: string, forceFull: boolean): Promise<SyncConfig> {
  if (forceFull) {
    console.log('Forced full sync requested');
    return { mode: 'full' };
  }

  const { data: status } = await supabase
    .from('jobber_sync_status')
    .select('last_sync_at, last_sync_status, last_full_sync_at')
    .eq('id', account)
    .single();

  // No previous successful sync -> full
  if (!status?.last_sync_at || status.last_sync_status !== 'success') {
    console.log('No previous successful sync, running full sync');
    return { mode: 'full' };
  }

  // If last full sync was >24h ago -> full (periodic catch-all)
  const lastFullSync = status.last_full_sync_at ? new Date(status.last_full_sync_at) : null;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (!lastFullSync || lastFullSync < twentyFourHoursAgo) {
    console.log('Last full sync >24h ago, running full sync');
    return { mode: 'full' };
  }

  // Incremental: sync since last_sync_at minus buffer
  const lastSyncAt = new Date(status.last_sync_at);
  const syncSince = new Date(lastSyncAt.getTime() - SYNC_BUFFER_MINUTES * 60 * 1000);
  console.log(`Incremental sync since ${syncSince.toISOString()}`);
  return { mode: 'incremental', syncSince: syncSince.toISOString() };
}

function getFilterClause(config: SyncConfig): string {
  if (config.mode === 'incremental' && config.syncSince) {
    return `filter: { updatedAt: { after: "${config.syncSince}" } }`;
  }
  return `filter: { createdAt: { after: "${SYNC_CUTOFF_DATE}" } }`;
}

/**
 * Refresh Jobber access token
 */
async function refreshToken(account: string, refreshTokenValue: string): Promise<string> {
  console.log(`Refreshing token for ${account}...`);

  if (!process.env.JOBBER_CLIENT_ID || !process.env.JOBBER_CLIENT_SECRET) {
    throw new Error('JOBBER_CLIENT_ID or JOBBER_CLIENT_SECRET not set');
  }

  const response = await fetch(JOBBER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
      client_id: process.env.JOBBER_CLIENT_ID,
      client_secret: process.env.JOBBER_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const token = await response.json();
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
    .eq('id', account);

  return token.access_token;
}

async function getAccessToken(account: string): Promise<string> {
  const { data: tokenData, error } = await supabase
    .from('jobber_tokens')
    .select('*')
    .eq('id', account)
    .single();

  if (error || !tokenData) {
    throw new Error(`No token found for ${account}`);
  }

  const expiresAt = new Date(tokenData.access_token_expires_at);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt < fiveMinutesFromNow) {
    return refreshToken(account, tokenData.refresh_token);
  }

  return tokenData.access_token;
}

async function graphqlQuery(
  accessToken: string,
  query: string,
  retries: number = 5
): Promise<{ data: unknown; cost?: unknown }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
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

      if (response.status === 429) {
        // Rate limited - wait and retry
        const waitTime = 3000 * Math.pow(2, attempt);
        console.log(`Rate limited (429), waiting ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        const errorMsg = result.errors[0]?.message || 'Unknown error';
        // Check for throttle error
        if (errorMsg.toLowerCase().includes('throttl')) {
          const waitTime = 3000 * Math.pow(2, attempt);
          console.log(`Throttled, waiting ${waitTime}ms before retry...`);
          lastError = new Error(`GraphQL errors: ${errorMsg}`);
          await sleep(waitTime);
          continue;
        }
        throw new Error(`GraphQL errors: ${errorMsg}`);
      }

      return { data: result.data, cost: result.extensions?.cost };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries - 1) {
        await sleep(2000 * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error('GraphQL request failed after retries');
}

// Query builders that accept sync config for incremental/full mode
function buildQuotesQuery(config: SyncConfig) {
  const filterClause = getFilterClause(config);
  return (cursor: string | null) => `
    query SyncQuotes {
      quotes(
        first: ${PAGE_SIZE}
        ${cursor ? `after: "${cursor}"` : ''}
        ${filterClause}
      ) {
        nodes {
          id
          quoteNumber
          title
          quoteStatus
          amounts { total subtotal discountAmount }
          client { id name billingAddress { street city province postalCode } }
          property { address { street city province postalCode } }
          createdAt
          updatedAt
          sentAt
          lastTransitioned { approvedAt convertedAt }
          request { id }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;
}

function buildJobsQuery(config: SyncConfig) {
  const filterClause = getFilterClause(config);
  return (cursor: string | null) => `
    query SyncJobs {
      jobs(
        first: ${PAGE_SIZE}
        ${cursor ? `after: "${cursor}"` : ''}
        ${filterClause}
      ) {
        nodes {
          id
          jobNumber
          title
          jobStatus
          total
          invoicedTotal
          client { id name }
          property { address { street city province postalCode } }
          createdAt
          updatedAt
          startAt
          endAt
          quote { id quoteNumber }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;
}

function buildRequestsQuery(config: SyncConfig) {
  const filterClause = getFilterClause(config);
  return (cursor: string | null) => `
    query SyncRequests {
      requests(
        first: ${PAGE_SIZE}
        ${cursor ? `after: "${cursor}"` : ''}
        ${filterClause}
      ) {
        nodes {
          id
          title
          requestStatus
          source
          createdAt
          updatedAt
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
}

async function syncEntity<T>(
  accessToken: string,
  queryBuilder: (cursor: string | null) => string,
  extractData: (data: unknown) => { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } },
  tableName: string,
  mapRecord: (item: T) => Record<string, unknown>
): Promise<number> {
  let cursor: string | null = null;
  let hasMore = true;
  let totalItems = 0;
  // Start with 3 second delay - queries cost ~1000-1500 points, restore is 500/sec
  let delayMs = 3000;

  while (hasMore) {
    const query = queryBuilder(cursor);
    const result = await graphqlQuery(accessToken, query);
    const { nodes, pageInfo } = extractData(result.data);

    if (nodes.length > 0) {
      const records = nodes.map(mapRecord);
      await supabase.from(tableName).upsert(records, { onConflict: 'jobber_id' });
      totalItems += nodes.length;
      console.log(`${tableName}: synced ${totalItems} items so far`);
    }

    hasMore = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    // Adaptive delay based on remaining points
    const throttleStatus = (result.cost as {
      throttleStatus?: { currentlyAvailable?: number; restoreRate?: number };
      actualQueryCost?: number;
    })?.throttleStatus;

    if (throttleStatus?.currentlyAvailable !== undefined) {
      const available = throttleStatus.currentlyAvailable;
      const queryCost = (result.cost as { actualQueryCost?: number })?.actualQueryCost || 1500;
      const restoreRate = throttleStatus.restoreRate || 500;

      if (available < queryCost * 2) {
        // Low on points - calculate wait time to restore enough
        const pointsNeeded = queryCost * 2 - available;
        const waitTime = Math.ceil((pointsNeeded / restoreRate) * 1000) + 500;
        console.log(`Low points (${available}), waiting ${waitTime}ms`);
        delayMs = Math.max(waitTime, delayMs);
      } else if (available > 6000) {
        // Good headroom - can reduce delay slightly
        delayMs = Math.max(2500, delayMs * 0.95);
      }
    }

    if (hasMore) {
      await sleep(delayMs);
    }
  }

  return totalItems;
}

/**
 * Background function for Jobber sync
 * Triggered by: POST /.netlify/functions/jobber-sync-background
 */
export const handler: BackgroundHandler = async (event) => {
  const body = JSON.parse(event.body || '{}');
  const account = (body.account || 'residential') as JobberAccount;
  const forceFull = body.mode === 'full';

  console.log(`Background sync started for ${account} (requested mode: ${body.mode || 'auto'})`);

  try {
    // Determine sync mode
    const config = await determineSyncMode(account, forceFull);
    console.log(`Sync mode: ${config.mode}${config.syncSince ? ` (since ${config.syncSince})` : ''}`);

    await supabase.from('jobber_sync_status').upsert({
      id: account,
      last_sync_status: 'in_progress',
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    const accessToken = await getAccessToken(account);
    const startTime = Date.now();

    // Sync quotes
    const quotesCount = await syncEntity(
      accessToken,
      buildQuotesQuery(config),
      (data) => (data as { quotes: { nodes: unknown[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).quotes,
      'jobber_api_quotes',
      (q: unknown) => {
        const quote = q as Record<string, unknown>;
        const client = quote.client as Record<string, unknown> | undefined;
        const property = quote.property as Record<string, { street?: string; city?: string; province?: string; postalCode?: string }> | undefined;
        const addr = property?.address || (client?.billingAddress as Record<string, string> | undefined);
        const amounts = quote.amounts as Record<string, number> | undefined;
        const lastTransitioned = quote.lastTransitioned as Record<string, string> | undefined;
        return {
          jobber_id: quote.id,
          quote_number: quote.quoteNumber,
          title: quote.title,
          status: (quote.quoteStatus as string)?.toLowerCase(),
          total: amounts?.total || 0,
          subtotal: amounts?.subtotal || 0,
          discount: amounts?.discountAmount || 0,
          client_jobber_id: client?.id,
          client_name: client?.name,
          service_street: addr?.street,
          service_city: addr?.city,
          service_state: addr?.province,
          service_zip: addr?.postalCode,
          drafted_at: quote.createdAt,
          sent_at: quote.sentAt,
          approved_at: lastTransitioned?.approvedAt,
          converted_at: lastTransitioned?.convertedAt,
          request_jobber_id: (quote.request as Record<string, string> | undefined)?.id,
          updated_at_jobber: quote.updatedAt,
          synced_at: new Date().toISOString(),
          raw_data: quote,
        };
      }
    );

    // Sync jobs
    const jobsCount = await syncEntity(
      accessToken,
      buildJobsQuery(config),
      (data) => (data as { jobs: { nodes: unknown[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).jobs,
      'jobber_api_jobs',
      (j: unknown) => {
        const job = j as Record<string, unknown>;
        const client = job.client as Record<string, unknown> | undefined;
        const property = job.property as Record<string, { street?: string; city?: string; province?: string; postalCode?: string }> | undefined;
        const addr = property?.address;
        const quote = job.quote as Record<string, unknown> | undefined;
        return {
          jobber_id: job.id,
          job_number: job.jobNumber,
          title: job.title,
          status: (job.jobStatus as string)?.toLowerCase(),
          total: job.total || 0,
          invoiced_total: job.invoicedTotal || 0,
          client_jobber_id: client?.id,
          client_name: client?.name,
          service_street: addr?.street,
          service_city: addr?.city,
          service_state: addr?.province,
          service_zip: addr?.postalCode,
          created_at_jobber: job.createdAt,
          scheduled_start_at: job.startAt,
          completed_at: job.endAt,
          quote_jobber_id: quote?.id,
          quote_number: quote?.quoteNumber,
          updated_at_jobber: job.updatedAt,
          synced_at: new Date().toISOString(),
          raw_data: job,
        };
      }
    );

    // Sync requests
    const requestsCount = await syncEntity(
      accessToken,
      buildRequestsQuery(config),
      (data) => (data as { requests: { nodes: unknown[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).requests,
      'jobber_api_requests',
      (r: unknown) => {
        const request = r as Record<string, unknown>;
        const client = request.client as Record<string, unknown> | undefined;
        const property = request.property as Record<string, { street?: string; city?: string; province?: string; postalCode?: string }> | undefined;
        const addr = property?.address;
        const assessment = request.assessment as Record<string, unknown> | undefined;

        // Extract salesperson from assessment.assignedUsers
        const assignedUsers = assessment?.assignedUsers as { nodes?: Array<{ name?: { full?: string } }> } | undefined;
        const salesperson = assignedUsers?.nodes?.[0]?.name?.full || null;

        return {
          jobber_id: request.id,
          title: request.title,
          status: (request.requestStatus as string)?.toLowerCase(),
          lead_source: request.source as string || null,
          created_at_jobber: request.createdAt as string || null,
          salesperson,
          client_jobber_id: client?.id,
          client_name: client?.name,
          service_street: addr?.street,
          service_city: addr?.city,
          service_state: addr?.province,
          service_zip: addr?.postalCode,
          assessment_start_at: (assessment?.startAt as string) || null,
          assessment_completed_at: (assessment?.completedAt as string) || null,
          updated_at_jobber: request.updatedAt,
          synced_at: new Date().toISOString(),
          raw_data: request,
        };
      }
    );

    // Compute opportunities
    let oppsCount = 0;
    if (account === 'residential') {
      const { data } = await supabase.rpc('compute_api_opportunities');
      oppsCount = data || 0;
    }

    const duration = (Date.now() - startTime) / 1000;

    await supabase.from('jobber_sync_status').update({
      last_sync_at: new Date().toISOString(),
      last_sync_type: config.mode,
      last_sync_status: 'success',
      last_error: null,
      quotes_synced: quotesCount,
      jobs_synced: jobsCount,
      requests_synced: requestsCount,
      opportunities_computed: oppsCount,
      ...(config.mode === 'full' ? { last_full_sync_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', account);

    console.log(`Background sync completed (${config.mode}): ${quotesCount} quotes, ${jobsCount} jobs, ${requestsCount} requests in ${duration}s`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Background sync failed:', errorMessage);

    await supabase.from('jobber_sync_status').update({
      last_sync_status: 'failed',
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    }).eq('id', account);
  }
};
