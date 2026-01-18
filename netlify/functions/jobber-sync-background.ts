import type { BackgroundHandler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
const PAGE_SIZE = 50;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

type JobberAccount = 'residential' | 'builders' | 'commercial';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function graphqlQuery(accessToken: string, query: string): Promise<{ data: unknown; cost?: unknown }> {
  const response = await fetch(JOBBER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION || '2025-01-20',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL errors: ${result.errors[0]?.message}`);
  }

  return { data: result.data, cost: result.extensions?.cost };
}

// Simplified queries (same as manual sync)
const QUOTES_QUERY = (cursor: string | null) => `
  query SyncQuotes {
    quotes(first: ${PAGE_SIZE}${cursor ? `, after: "${cursor}"` : ''}) {
      nodes {
        id
        quoteNumber
        title
        quoteStatus
        amounts { total subtotal discountAmount }
        client { id name billingAddress { street city province postalCode } }
        property { address { street city province postalCode } }
        createdAt
        sentAt
        lastTransitioned { approvedAt convertedAt }
        request { id }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const JOBS_QUERY = (cursor: string | null) => `
  query SyncJobs {
    jobs(first: ${PAGE_SIZE}${cursor ? `, after: "${cursor}"` : ''}) {
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
        startAt
        endAt
        quote { id quoteNumber }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const REQUESTS_QUERY = (cursor: string | null) => `
  query SyncRequests {
    requests(first: ${PAGE_SIZE}${cursor ? `, after: "${cursor}"` : ''}) {
      nodes {
        id
        title
        requestStatus
        client { id name }
        property { address { street city province postalCode } }
        assessment { startAt completedAt }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

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
  let delayMs = 1000;

  while (hasMore) {
    const query = queryBuilder(cursor);
    const result = await graphqlQuery(accessToken, query);
    const { nodes, pageInfo } = extractData(result.data);

    if (nodes.length > 0) {
      const records = nodes.map(mapRecord);
      await supabase.from(tableName).upsert(records, { onConflict: 'jobber_id' });
      totalItems += nodes.length;
    }

    hasMore = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    // Adaptive delay based on cost
    const throttleStatus = (result.cost as { throttleStatus?: { currentlyAvailable?: number } })?.throttleStatus;
    if (throttleStatus?.currentlyAvailable !== undefined && throttleStatus.currentlyAvailable < 3000) {
      delayMs = Math.max(2000, delayMs);
    }

    if (hasMore) {
      await sleep(delayMs);
    }
  }

  return totalItems;
}

/**
 * Background function for Jobber sync
 * Triggered by: POST /.netlify/functions/jobber-sync-manual.background
 */
export const handler: BackgroundHandler = async (event) => {
  const account = (JSON.parse(event.body || '{}').account || 'residential') as JobberAccount;

  console.log(`Background sync started for ${account}`);

  try {
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
      QUOTES_QUERY,
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
          synced_at: new Date().toISOString(),
          raw_data: quote,
        };
      }
    );

    // Sync jobs
    const jobsCount = await syncEntity(
      accessToken,
      JOBS_QUERY,
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
          synced_at: new Date().toISOString(),
          raw_data: job,
        };
      }
    );

    // Sync requests
    const requestsCount = await syncEntity(
      accessToken,
      REQUESTS_QUERY,
      (data) => (data as { requests: { nodes: unknown[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).requests,
      'jobber_api_requests',
      (r: unknown) => {
        const request = r as Record<string, unknown>;
        const client = request.client as Record<string, unknown> | undefined;
        const property = request.property as Record<string, { street?: string; city?: string; province?: string; postalCode?: string }> | undefined;
        const addr = property?.address;
        const assessment = request.assessment as Record<string, string> | undefined;
        return {
          jobber_id: request.id,
          title: request.title,
          status: (request.requestStatus as string)?.toLowerCase(),
          client_jobber_id: client?.id,
          client_name: client?.name,
          service_street: addr?.street,
          service_city: addr?.city,
          service_state: addr?.province,
          service_zip: addr?.postalCode,
          assessment_start_at: assessment?.startAt,
          assessment_completed_at: assessment?.completedAt,
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
      last_sync_type: 'full',
      last_sync_status: 'success',
      last_error: null,
      quotes_synced: quotesCount,
      jobs_synced: jobsCount,
      requests_synced: requestsCount,
      opportunities_computed: oppsCount,
      updated_at: new Date().toISOString(),
    }).eq('id', account);

    console.log(`Background sync completed: ${quotesCount} quotes, ${jobsCount} jobs, ${requestsCount} requests in ${duration}s`);

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
