/**
 * Shared Jobber Sync Core Library
 *
 * Single source of truth for all Jobber API sync operations.
 * Used by: jobber-sync-background, jobber-sync-manual, jobber-sync-residential
 */
import { createClient } from '@supabase/supabase-js';

// ============================================
// CONSTANTS
// ============================================

export const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';
export const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
export const PAGE_SIZE = 50;
export const SYNC_BUFFER_MINUTES = 5;

// Full sync lookback: 100 days rolling window.
// Projects complete within ~30 days, so 100 days gives 3x safety margin.
// Old records stay in DB (upsert doesn't delete), we just stop re-fetching them.
export const FULL_SYNC_LOOKBACK_DAYS = 100;

function getFullSyncCutoffDate(): string {
  const cutoff = new Date(Date.now() - FULL_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

// ============================================
// SUPABASE CLIENT
// ============================================

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

// ============================================
// TYPES
// ============================================

export type JobberAccount = 'residential' | 'builders' | 'commercial';
export type SyncMode = 'full' | 'incremental';

export interface SyncConfig {
  mode: SyncMode;
  syncSince?: string; // ISO timestamp for incremental
}

export interface SyncStats {
  quotesProcessed: number;
  jobsProcessed: number;
  requestsProcessed: number;
  opportunitiesComputed: number;
  syncMode: SyncMode;
  errors: string[];
  duration: number;
}

export interface JobberQuote {
  id: string;
  quoteNumber: number;
  title: string;
  quoteStatus: string;
  amounts?: {
    total?: number;
    subtotal?: number;
    discountAmount?: number;
  };
  client?: {
    id: string;
    name: string;
    billingAddress?: {
      street?: string;
      city?: string;
      province?: string;
      postalCode?: string;
    };
  };
  property?: {
    address?: {
      street?: string;
      city?: string;
      province?: string;
      postalCode?: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
  sentAt?: string;
  lastTransitioned?: {
    approvedAt?: string;
    convertedAt?: string;
  };
  request?: {
    id: string;
  };
}

export interface JobberJob {
  id: string;
  jobNumber: number;
  title: string;
  jobStatus: string;
  total?: number;
  invoicedTotal?: number;
  client?: {
    id: string;
    name: string;
  };
  property?: {
    address?: {
      street?: string;
      city?: string;
      province?: string;
      postalCode?: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
  startAt?: string;
  endAt?: string;
  quote?: {
    id: string;
    quoteNumber: number;
  };
}

export interface JobberRequest {
  id: string;
  title: string;
  requestStatus: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  client?: {
    id: string;
    name: string;
  };
  property?: {
    address?: {
      street?: string;
      city?: string;
      province?: string;
      postalCode?: string;
    };
  };
  assessment?: {
    startAt?: string;
    completedAt?: string;
    assignedUsers?: {
      nodes?: Array<{
        name?: {
          full?: string;
        };
      }>;
    };
  };
}

// ============================================
// UTILITIES
// ============================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * Refresh Jobber access token with detailed error handling
 */
export async function refreshToken(account: string, refreshTokenValue: string): Promise<string> {
  console.log(`Refreshing token for ${account}...`);

  if (!process.env.JOBBER_CLIENT_ID) {
    throw new Error('JOBBER_CLIENT_ID environment variable is not set');
  }
  if (!process.env.JOBBER_CLIENT_SECRET) {
    throw new Error('JOBBER_CLIENT_SECRET environment variable is not set');
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

    // Parse specific error types from Jobber
    let errorMessage = `Token refresh failed: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error === 'invalid_grant') {
        errorMessage = 'Refresh token is invalid or expired. Please reconnect the Jobber integration at /settings/integrations.';
      } else if (errorJson.error === 'unauthorized_client') {
        errorMessage = 'App is not authorized. Please reconnect the Jobber integration.';
      } else if (errorJson.error_description) {
        errorMessage = `Token refresh failed: ${errorJson.error_description}`;
      }
    } catch {
      errorMessage += ` - ${errorText}`;
    }

    throw new Error(errorMessage);
  }

  const token = await response.json();

  if (!token.access_token) {
    throw new Error('Token refresh response missing access_token');
  }

  const now = new Date();
  const expiresIn = token.expires_in || 3600;
  const accessTokenExpiresAt = new Date(now.getTime() + expiresIn * 1000);

  const { error: updateError } = await supabase
    .from('jobber_tokens')
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token || refreshTokenValue,
      access_token_expires_at: accessTokenExpiresAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', account);

  if (updateError) {
    console.error('Failed to save refreshed token:', updateError);
    // Don't throw - we can still use the token even if we couldn't save it
  }

  console.log(`Token refreshed successfully, valid until ${accessTokenExpiresAt.toISOString()}`);
  return token.access_token;
}

/**
 * Get valid access token, refreshing if expired or expiring within 15 minutes.
 * 15-min buffer ensures token doesn't expire mid-sync (parallel syncs take ~10 min).
 */
export async function getAccessToken(account: string): Promise<string> {
  const { data: tokenData, error: tokenError } = await supabase
    .from('jobber_tokens')
    .select('*')
    .eq('id', account)
    .single();

  if (tokenError) {
    console.error('Token lookup error:', tokenError);
    throw new Error(`Failed to look up token for ${account}: ${tokenError.message}`);
  }

  if (!tokenData) {
    throw new Error(`No token found for ${account}. Please connect via OAuth first at /settings/integrations.`);
  }

  const expiresAt = new Date(tokenData.access_token_expires_at);
  // Buffer must exceed max sync duration (~10 min parallel) to avoid mid-sync expiry
  const fifteenMinutesFromNow = new Date(Date.now() + 15 * 60 * 1000);

  if (expiresAt < fifteenMinutesFromNow) {
    console.log(`Access token ${expiresAt < new Date() ? 'expired' : 'expiring soon'}, refreshing...`);
    return refreshToken(account, tokenData.refresh_token);
  }

  console.log(`Token valid until ${expiresAt.toISOString()}`);
  return tokenData.access_token;
}

// ============================================
// GRAPHQL QUERY WITH ROBUST RETRY LOGIC
// ============================================

/**
 * Make GraphQL query to Jobber API with:
 * - Exponential backoff retry
 * - 429 rate limit handling (with Retry-After header)
 * - 401 token auto-refresh
 * - Throttle detection in GraphQL response
 * - Temporary error retry (timeouts, server errors)
 * - JSON parse safety
 */
export async function graphqlQuery(
  initialAccessToken: string,
  query: string,
  account: string = 'residential',
  retries: number = 5,
  baseDelayMs: number = 1000
): Promise<{ data: unknown; cost?: { requestedQueryCost?: number; actualQueryCost?: number; throttleStatus?: unknown } }> {
  let lastError: Error | null = null;
  let accessToken = initialAccessToken;

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

      // Handle rate limiting (429 Too Many Requests)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : baseDelayMs * Math.pow(2, attempt);
        lastError = new Error('Rate limited (429)');
        console.warn(`Rate limited (429). Waiting ${waitTime}ms before retry ${attempt + 1}/${retries}...`);
        await sleep(waitTime);
        continue;
      }

      // Token expired mid-sync - refresh and retry
      if (response.status === 401) {
        console.log('Token expired (401), refreshing...');
        accessToken = await getAccessToken(account);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP ${response.status} response:`, errorText.substring(0, 500));

        // Auth errors (403) shouldn't be retried
        if (response.status === 403) {
          throw new Error(`Auth error: ${response.status} - ${errorText}`);
        }

        // Other errors - retry with backoff
        lastError = new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
        console.warn(`Request failed (${response.status}). Retry ${attempt + 1}/${retries}...`);
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }

      const responseText = await response.text();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        console.error('Failed to parse JSON response:', responseText.substring(0, 500));
        lastError = new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }

      // Check for throttled status in extensions
      const cost = result.extensions?.cost;
      if (cost?.throttleStatus === 'THROTTLED') {
        const waitTime = baseDelayMs * Math.pow(2, attempt);
        console.warn(`Throttled by Jobber (extensions.cost). Waiting ${waitTime}ms...`);
        await sleep(waitTime);
      }

      // Check for GraphQL-level errors
      if (result.errors) {
        const errorMessages = result.errors.map((e: { message?: string }) => e.message || 'Unknown').join(', ');

        // Check for rate limit / throttle errors
        const isThrottled = result.errors.some((e: { message?: string; extensions?: { code?: string } }) =>
          e.message?.toLowerCase().includes('throttl') ||
          e.extensions?.code === 'THROTTLED'
        );

        if (isThrottled) {
          const waitTime = Math.max(1500, baseDelayMs * Math.pow(2, attempt));
          lastError = new Error(`GraphQL throttled: ${errorMessages}`);
          console.warn(`GraphQL throttled. Waiting ${waitTime}ms before retry ${attempt + 1}/${retries}...`);
          await sleep(waitTime);
          continue;
        }

        // Check for temporary errors that might be retried
        const isTemporary = result.errors.some((e: { message?: string; extensions?: { code?: string } }) =>
          e.message?.toLowerCase().includes('timeout') ||
          e.message?.toLowerCase().includes('temporarily') ||
          e.extensions?.code === 'INTERNAL_SERVER_ERROR'
        );

        if (isTemporary && attempt < retries - 1) {
          lastError = new Error(`Temporary error: ${errorMessages}`);
          console.warn(`Temporary error: ${errorMessages}. Retry ${attempt + 1}/${retries}...`);
          await sleep(baseDelayMs * Math.pow(2, attempt));
          continue;
        }

        throw new Error(`GraphQL errors: ${errorMessages}`);
      }

      // Validate we got data
      if (!result.data) {
        lastError = new Error('GraphQL response missing data field');
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }

      return { data: result.data, cost };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${attempt + 1} failed:`, lastError.message);

      // Don't retry auth errors
      if (lastError.message.includes('Auth error')) {
        throw lastError;
      }

      if (attempt < retries - 1) {
        const waitTime = baseDelayMs * Math.pow(2, attempt);
        await sleep(waitTime);
      }
    }
  }

  throw new Error(`GraphQL request failed after ${retries} retries: ${lastError?.message || 'Unknown error'}`);
}

// ============================================
// SYNC MODE DETERMINATION
// ============================================

/**
 * Determine sync mode based on last sync status.
 * Returns full sync if no previous success, forced, or no prior sync data.
 * Returns incremental with 5-min buffer otherwise.
 */
export async function determineSyncMode(account: string, forceFull: boolean): Promise<SyncConfig> {
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

  // Incremental: sync since last_sync_at minus buffer
  const lastSyncAt = new Date(status.last_sync_at);
  const syncSince = new Date(lastSyncAt.getTime() - SYNC_BUFFER_MINUTES * 60 * 1000);
  console.log(`Incremental sync since ${syncSince.toISOString()}`);
  return { mode: 'incremental', syncSince: syncSince.toISOString() };
}

/**
 * Get the appropriate filter clause for a GraphQL query.
 * Quotes support updatedAt filter; Jobs and Requests only support createdAt.
 */
export function getFilterClause(config: SyncConfig, entity: 'quotes' | 'jobs' | 'requests'): string {
  if (config.mode === 'incremental' && config.syncSince) {
    if (entity === 'quotes') {
      return `filter: { updatedAt: { after: "${config.syncSince}" } }`;
    }
    // Jobs and Requests don't support updatedAt filter in Jobber API
    return `filter: { createdAt: { after: "${config.syncSince}" } }`;
  }
  return `filter: { createdAt: { after: "${getFullSyncCutoffDate()}" } }`;
}

// ============================================
// QUERY BUILDERS
// ============================================

export function buildQuotesQuery(config: SyncConfig) {
  const filterClause = getFilterClause(config, 'quotes');
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
          client {
            id
            name
            billingAddress { street city province postalCode }
          }
          property {
            address { street city province postalCode }
          }
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

export function buildJobsQuery(config: SyncConfig) {
  const filterClause = getFilterClause(config, 'jobs');
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
          property {
            address { street city province postalCode }
          }
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

export function buildRequestsQuery(config: SyncConfig) {
  const filterClause = getFilterClause(config, 'requests');
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
          property {
            address { street city province postalCode }
          }
          assessment {
            startAt
            completedAt
            assignedUsers {
              nodes { name { full } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;
}

// ============================================
// RECORD MAPPERS
// ============================================

export function mapQuoteRecord(q: JobberQuote): Record<string, unknown> {
  const addr = q.property?.address || q.client?.billingAddress;
  return {
    jobber_id: q.id,
    quote_number: q.quoteNumber,
    title: q.title,
    status: q.quoteStatus?.toLowerCase(),
    total: q.amounts?.total || 0,
    subtotal: q.amounts?.subtotal || 0,
    discount: q.amounts?.discountAmount || 0,
    client_jobber_id: q.client?.id,
    client_name: q.client?.name,
    service_street: addr?.street,
    service_city: addr?.city,
    service_state: addr?.province,
    service_zip: addr?.postalCode,
    drafted_at: q.createdAt,
    sent_at: q.sentAt,
    approved_at: q.lastTransitioned?.approvedAt,
    converted_at: q.lastTransitioned?.convertedAt,
    request_jobber_id: q.request?.id,
    updated_at_jobber: q.updatedAt,
    synced_at: new Date().toISOString(),
    raw_data: q,
  };
}

export function mapJobRecord(j: JobberJob): Record<string, unknown> {
  const addr = j.property?.address;
  return {
    jobber_id: j.id,
    job_number: j.jobNumber,
    title: j.title,
    status: j.jobStatus?.toLowerCase(),
    total: j.total || 0,
    invoiced_total: j.invoicedTotal || 0,
    client_jobber_id: j.client?.id,
    client_name: j.client?.name,
    service_street: addr?.street,
    service_city: addr?.city,
    service_state: addr?.province,
    service_zip: addr?.postalCode,
    created_at_jobber: j.createdAt,
    scheduled_start_at: j.startAt,
    completed_at: j.endAt,
    quote_jobber_id: j.quote?.id,
    quote_number: j.quote?.quoteNumber,
    updated_at_jobber: j.updatedAt,
    synced_at: new Date().toISOString(),
    raw_data: j,
  };
}

export function mapRequestRecord(r: JobberRequest): Record<string, unknown> {
  const addr = r.property?.address;
  const salesperson = r.assessment?.assignedUsers?.nodes?.[0]?.name?.full || null;
  return {
    jobber_id: r.id,
    title: r.title,
    status: r.requestStatus?.toLowerCase(),
    lead_source: r.source || null,
    created_at_jobber: r.createdAt || null,
    salesperson,
    client_jobber_id: r.client?.id,
    client_name: r.client?.name,
    service_street: addr?.street,
    service_city: addr?.city,
    service_state: addr?.province,
    service_zip: addr?.postalCode,
    assessment_start_at: r.assessment?.startAt || null,
    assessment_completed_at: r.assessment?.completedAt || null,
    updated_at_jobber: r.updatedAt,
    synced_at: new Date().toISOString(),
    raw_data: r,
  };
}

// ============================================
// GENERIC SYNC ENTITY (with adaptive rate limiting)
// ============================================

/**
 * Fetch all pages of a Jobber entity and upsert into Supabase.
 * Uses adaptive rate limiting based on Jobber's cost/throttle feedback.
 */
export async function syncEntity<T>(
  accessToken: string,
  account: string,
  queryBuilder: (cursor: string | null) => string,
  extractData: (data: unknown) => { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } },
  tableName: string,
  mapRecord: (item: T) => Record<string, unknown>
): Promise<number> {
  let cursor: string | null = null;
  let hasMore = true;
  let totalItems = 0;
  // Start with 3s delay - queries cost ~1000-1500 points, restore is 500/sec
  let delayMs = 3000;

  while (hasMore) {
    const query = queryBuilder(cursor);
    const result = await graphqlQuery(accessToken, query, account);
    const { nodes, pageInfo } = extractData(result.data);

    if (nodes.length > 0) {
      // Batch upsert in chunks of 100
      for (let i = 0; i < nodes.length; i += 100) {
        const batch = nodes.slice(i, i + 100);
        const records = batch.map(mapRecord);
        const { error } = await supabase.from(tableName).upsert(records, { onConflict: 'jobber_id' });
        if (error) {
          console.error(`Error upserting ${tableName} batch:`, error);
        }
      }
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

// ============================================
// HIGH-LEVEL SYNC FUNCTIONS
// ============================================

export async function syncQuotes(accessToken: string, account: string, config: SyncConfig): Promise<number> {
  console.log(`Syncing quotes (${config.mode})...`);
  return syncEntity<JobberQuote>(
    accessToken,
    account,
    buildQuotesQuery(config),
    (data) => (data as { quotes: { nodes: JobberQuote[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).quotes,
    'jobber_api_quotes',
    mapQuoteRecord
  );
}

export async function syncJobs(accessToken: string, account: string, config: SyncConfig): Promise<number> {
  console.log(`Syncing jobs (${config.mode})...`);
  return syncEntity<JobberJob>(
    accessToken,
    account,
    buildJobsQuery(config),
    (data) => (data as { jobs: { nodes: JobberJob[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).jobs,
    'jobber_api_jobs',
    mapJobRecord
  );
}

export async function syncRequests(accessToken: string, account: string, config: SyncConfig): Promise<number> {
  console.log(`Syncing requests (${config.mode})...`);
  return syncEntity<JobberRequest>(
    accessToken,
    account,
    buildRequestsQuery(config),
    (data) => (data as { requests: { nodes: JobberRequest[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).requests,
    'jobber_api_requests',
    mapRequestRecord
  );
}

export async function computeOpportunities(): Promise<number> {
  console.log('Computing opportunities...');
  const { data, error } = await supabase.rpc('compute_api_opportunities');
  if (error) {
    console.error('Error computing opportunities:', error);
    throw new Error(`Failed to compute opportunities: ${error.message}`);
  }
  console.log(`Computed ${data} opportunities`);
  return data || 0;
}

// ============================================
// SYNC STATUS HELPERS
// ============================================

export async function markSyncInProgress(account: string): Promise<void> {
  await supabase.from('jobber_sync_status').upsert({
    id: account,
    last_sync_status: 'in_progress',
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
}

export async function markSyncSuccess(
  account: string,
  config: SyncConfig,
  stats: { quotes: number; jobs: number; requests: number; opportunities: number }
): Promise<void> {
  await supabase.from('jobber_sync_status').update({
    last_sync_at: new Date().toISOString(),
    last_sync_type: config.mode,
    last_sync_status: 'success',
    last_error: null,
    quotes_synced: stats.quotes,
    jobs_synced: stats.jobs,
    requests_synced: stats.requests,
    opportunities_computed: stats.opportunities,
    ...(config.mode === 'full' ? { last_full_sync_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', account);
}

export async function markSyncFailed(account: string, errorMessage: string): Promise<void> {
  await supabase.from('jobber_sync_status').update({
    last_sync_status: 'failed',
    last_error: errorMessage,
    updated_at: new Date().toISOString(),
  }).eq('id', account);
}

// ============================================
// FULL SYNC ORCHESTRATOR
// ============================================

/**
 * Run a complete sync for an account. Used by all 3 entry points.
 * Syncs quotes, jobs, and requests in parallel, then computes opportunities.
 */
export async function runFullSync(account: JobberAccount, forceFull: boolean = false): Promise<SyncStats> {
  const stats: SyncStats = {
    quotesProcessed: 0,
    jobsProcessed: 0,
    requestsProcessed: 0,
    opportunitiesComputed: 0,
    syncMode: 'full',
    errors: [],
    duration: 0,
  };

  const startTime = Date.now();

  try {
    const config = await determineSyncMode(account, forceFull);
    stats.syncMode = config.mode;
    console.log(`Sync mode: ${config.mode}${config.syncSince ? ` (since ${config.syncSince})` : ''}`);

    await markSyncInProgress(account);

    const accessToken = await getAccessToken(account);

    // Sync all entities IN PARALLEL to stay within 15-min timeout
    const [quotesCount, jobsCount, requestsCount] = await Promise.all([
      syncQuotes(accessToken, account, config),
      syncJobs(accessToken, account, config),
      syncRequests(accessToken, account, config),
    ]);

    stats.quotesProcessed = quotesCount;
    stats.jobsProcessed = jobsCount;
    stats.requestsProcessed = requestsCount;

    // Compute opportunities (only for residential for now)
    if (account === 'residential') {
      stats.opportunitiesComputed = await computeOpportunities();
    }

    stats.duration = (Date.now() - startTime) / 1000;

    await markSyncSuccess(account, config, {
      quotes: quotesCount,
      jobs: jobsCount,
      requests: requestsCount,
      opportunities: stats.opportunitiesComputed,
    });

    console.log(`Sync completed (${config.mode}) in ${stats.duration.toFixed(1)}s: ${quotesCount} quotes, ${jobsCount} jobs, ${requestsCount} requests`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);
    stats.duration = (Date.now() - startTime) / 1000;
    console.error('Sync failed:', errorMessage);

    await markSyncFailed(account, errorMessage);
  }

  return stats;
}
