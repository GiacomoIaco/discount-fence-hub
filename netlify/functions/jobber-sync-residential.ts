import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
const ACCOUNT = 'residential';
const PAGE_SIZE = 100;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

interface SyncStats {
  quotesProcessed: number;
  jobsProcessed: number;
  requestsProcessed: number;
  opportunitiesComputed: number;
  errors: string[];
}

/**
 * Refresh Jobber access token
 */
async function refreshToken(refreshTokenValue: string): Promise<string> {
  console.log(`Refreshing token for ${ACCOUNT}...`);

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
    .eq('id', ACCOUNT);

  console.log('Token refreshed successfully');
  return token.access_token;
}

/**
 * Get valid access token (refreshing if expired)
 */
async function getAccessToken(): Promise<string> {
  const { data: tokenData, error: tokenError } = await supabase
    .from('jobber_tokens')
    .select('*')
    .eq('id', ACCOUNT)
    .single();

  if (tokenError || !tokenData) {
    throw new Error(`No token found for ${ACCOUNT}. Please connect via OAuth first.`);
  }

  const isExpired = new Date(tokenData.access_token_expires_at) < new Date();

  if (isExpired) {
    console.log('Access token expired, refreshing...');
    return refreshToken(tokenData.refresh_token);
  }

  return tokenData.access_token;
}

/**
 * Make GraphQL query to Jobber API
 */
async function graphqlQuery(accessToken: string, query: string, variables?: Record<string, unknown>) {
  const response = await fetch(JOBBER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION || '2025-01-20',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GraphQL request failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error('GraphQL errors:', JSON.stringify(result.errors, null, 2));
    throw new Error(`GraphQL errors: ${result.errors[0]?.message || 'Unknown error'}`);
  }

  return result.data;
}

/**
 * Fetch all pages of a GraphQL query
 */
async function fetchAllPages<T>(
  accessToken: string,
  queryBuilder: (cursor: string | null) => string,
  extractData: (data: unknown) => { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
): Promise<T[]> {
  const allItems: T[] = [];
  let cursor: string | null = null;
  let hasMore = true;
  let pageNum = 0;

  while (hasMore) {
    pageNum++;
    console.log(`Fetching page ${pageNum}...`);

    const query = queryBuilder(cursor);
    const data = await graphqlQuery(accessToken, query);
    const { nodes, pageInfo } = extractData(data);

    allItems.push(...nodes);

    hasMore = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    // Rate limiting - wait 200ms between requests
    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log(`Fetched ${allItems.length} items in ${pageNum} pages`);
  return allItems;
}

// ============================================
// SYNC QUOTES
// ============================================

const QUOTES_QUERY = (cursor: string | null) => `
  query SyncQuotes {
    quotes(first: ${PAGE_SIZE}${cursor ? `, after: "${cursor}"` : ''}) {
      nodes {
        id
        quoteNumber
        title
        quoteStatus
        amounts {
          totalPrice
          subtotal
          discountAmount
        }
        client {
          id
          name
          billingAddress {
            street
            city
            province
            postalCode
          }
          phones {
            number
          }
          emails {
            address
          }
        }
        property {
          address {
            street
            city
            province
            postalCode
          }
        }
        createdAt
        sentAt
        approvedAt
        convertedToJobAt
        jobs {
          nodes {
            id
          }
        }
        request {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface JobberQuote {
  id: string;
  quoteNumber: number;
  title: string;
  quoteStatus: string;
  amounts?: {
    totalPrice?: number;
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
    phones?: Array<{ number?: string }>;
    emails?: Array<{ address?: string }>;
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
  sentAt?: string;
  approvedAt?: string;
  convertedToJobAt?: string;
  jobs?: {
    nodes?: Array<{ id: string }>;
  };
  request?: {
    id: string;
  };
}

async function syncQuotes(accessToken: string): Promise<number> {
  console.log('Syncing quotes...');

  const quotes = await fetchAllPages<JobberQuote>(
    accessToken,
    QUOTES_QUERY,
    (data) => (data as { quotes: { nodes: JobberQuote[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).quotes
  );

  console.log(`Processing ${quotes.length} quotes...`);

  // Batch upsert in chunks of 100
  for (let i = 0; i < quotes.length; i += 100) {
    const batch = quotes.slice(i, i + 100);

    const records = batch.map((q) => {
      const addr = q.property?.address || q.client?.billingAddress;

      return {
        jobber_id: q.id,
        quote_number: q.quoteNumber,
        title: q.title,
        status: q.quoteStatus?.toLowerCase().replace(/_/g, '_'),
        total: q.amounts?.totalPrice || 0,
        subtotal: q.amounts?.subtotal || 0,
        discount: q.amounts?.discountAmount || 0,
        client_jobber_id: q.client?.id,
        client_name: q.client?.name,
        client_email: q.client?.emails?.[0]?.address,
        client_phone: q.client?.phones?.[0]?.number,
        service_street: addr?.street,
        service_city: addr?.city,
        service_state: addr?.province,
        service_zip: addr?.postalCode,
        drafted_at: q.createdAt,
        sent_at: q.sentAt,
        approved_at: q.approvedAt,
        converted_at: q.convertedToJobAt,
        job_jobber_ids: q.jobs?.nodes?.map((j) => j.id) || [],
        request_jobber_id: q.request?.id,
        synced_at: new Date().toISOString(),
        raw_data: q,
      };
    });

    const { error } = await supabase
      .from('jobber_api_quotes')
      .upsert(records, { onConflict: 'jobber_id' });

    if (error) {
      console.error(`Error upserting quotes batch ${i / 100 + 1}:`, error);
    }
  }

  return quotes.length;
}

// ============================================
// SYNC JOBS
// ============================================

const JOBS_QUERY = (cursor: string | null) => `
  query SyncJobs {
    jobs(first: ${PAGE_SIZE}${cursor ? `, after: "${cursor}"` : ''}) {
      nodes {
        id
        jobNumber
        title
        jobStatus
        amounts {
          totalPrice
          invoicedTotal
        }
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
        createdAt
        startAt
        endAt
        closedAt
        quote {
          id
          quoteNumber
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface JobberJob {
  id: string;
  jobNumber: number;
  title: string;
  jobStatus: string;
  amounts?: {
    totalPrice?: number;
    invoicedTotal?: number;
  };
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
  startAt?: string;
  endAt?: string;
  closedAt?: string;
  quote?: {
    id: string;
    quoteNumber: number;
  };
}

async function syncJobs(accessToken: string): Promise<number> {
  console.log('Syncing jobs...');

  const jobs = await fetchAllPages<JobberJob>(
    accessToken,
    JOBS_QUERY,
    (data) => (data as { jobs: { nodes: JobberJob[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).jobs
  );

  console.log(`Processing ${jobs.length} jobs...`);

  // Batch upsert in chunks of 100
  for (let i = 0; i < jobs.length; i += 100) {
    const batch = jobs.slice(i, i + 100);

    const records = batch.map((j) => {
      const addr = j.property?.address;

      return {
        jobber_id: j.id,
        job_number: j.jobNumber,
        title: j.title,
        status: j.jobStatus?.toLowerCase().replace(/_/g, '_'),
        total: j.amounts?.totalPrice || 0,
        invoiced_total: j.amounts?.invoicedTotal || 0,
        client_jobber_id: j.client?.id,
        client_name: j.client?.name,
        service_street: addr?.street,
        service_city: addr?.city,
        service_state: addr?.province,
        service_zip: addr?.postalCode,
        created_at_jobber: j.createdAt,
        scheduled_start_at: j.startAt,
        completed_at: j.endAt,
        closed_at: j.closedAt,
        quote_jobber_id: j.quote?.id,
        quote_number: j.quote?.quoteNumber,
        synced_at: new Date().toISOString(),
        raw_data: j,
      };
    });

    const { error } = await supabase
      .from('jobber_api_jobs')
      .upsert(records, { onConflict: 'jobber_id' });

    if (error) {
      console.error(`Error upserting jobs batch ${i / 100 + 1}:`, error);
    }
  }

  return jobs.length;
}

// ============================================
// SYNC REQUESTS
// ============================================

const REQUESTS_QUERY = (cursor: string | null) => `
  query SyncRequests {
    requests(first: ${PAGE_SIZE}${cursor ? `, after: "${cursor}"` : ''}) {
      nodes {
        id
        title
        requestStatus
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
        }
        quotes {
          nodes {
            id
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

interface JobberRequest {
  id: string;
  title: string;
  requestStatus: string;
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
  };
  quotes?: {
    nodes?: Array<{ id: string }>;
  };
}

async function syncRequests(accessToken: string): Promise<number> {
  console.log('Syncing requests...');

  const requests = await fetchAllPages<JobberRequest>(
    accessToken,
    REQUESTS_QUERY,
    (data) => (data as { requests: { nodes: JobberRequest[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).requests
  );

  console.log(`Processing ${requests.length} requests...`);

  // Batch upsert in chunks of 100
  for (let i = 0; i < requests.length; i += 100) {
    const batch = requests.slice(i, i + 100);

    const records = batch.map((r) => {
      const addr = r.property?.address;

      return {
        jobber_id: r.id,
        title: r.title,
        status: r.requestStatus?.toLowerCase().replace(/_/g, '_'),
        client_jobber_id: r.client?.id,
        client_name: r.client?.name,
        service_street: addr?.street,
        service_city: addr?.city,
        service_state: addr?.province,
        service_zip: addr?.postalCode,
        assessment_start_at: r.assessment?.startAt,
        assessment_completed_at: r.assessment?.completedAt,
        quote_jobber_ids: r.quotes?.nodes?.map((q) => q.id) || [],
        synced_at: new Date().toISOString(),
        raw_data: r,
      };
    });

    const { error } = await supabase
      .from('jobber_api_requests')
      .upsert(records, { onConflict: 'jobber_id' });

    if (error) {
      console.error(`Error upserting requests batch ${i / 100 + 1}:`, error);
    }
  }

  return requests.length;
}

// ============================================
// COMPUTE OPPORTUNITIES
// ============================================

async function computeOpportunities(): Promise<number> {
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
// MAIN SYNC HANDLER
// ============================================

async function runSync(): Promise<SyncStats> {
  const stats: SyncStats = {
    quotesProcessed: 0,
    jobsProcessed: 0,
    requestsProcessed: 0,
    opportunitiesComputed: 0,
    errors: [],
  };

  const startTime = Date.now();

  try {
    // Mark sync as in progress
    await supabase
      .from('jobber_sync_status')
      .upsert({
        id: ACCOUNT,
        last_sync_status: 'in_progress',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    // Get access token
    const accessToken = await getAccessToken();

    // Sync all data
    stats.quotesProcessed = await syncQuotes(accessToken);
    stats.jobsProcessed = await syncJobs(accessToken);
    stats.requestsProcessed = await syncRequests(accessToken);

    // Compute opportunities
    stats.opportunitiesComputed = await computeOpportunities();

    // Mark sync as successful
    await supabase
      .from('jobber_sync_status')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_type: 'full',
        last_sync_status: 'success',
        last_error: null,
        quotes_synced: stats.quotesProcessed,
        jobs_synced: stats.jobsProcessed,
        requests_synced: stats.requestsProcessed,
        opportunities_computed: stats.opportunitiesComputed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ACCOUNT);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Sync completed in ${duration}s`);
    console.log(`  Quotes: ${stats.quotesProcessed}`);
    console.log(`  Jobs: ${stats.jobsProcessed}`);
    console.log(`  Requests: ${stats.requestsProcessed}`);
    console.log(`  Opportunities: ${stats.opportunitiesComputed}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);
    console.error('Sync failed:', errorMessage);

    // Mark sync as failed
    await supabase
      .from('jobber_sync_status')
      .update({
        last_sync_status: 'failed',
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ACCOUNT);
  }

  return stats;
}

/**
 * Main handler - can be invoked directly or via schedule
 * GET /.netlify/functions/jobber-sync-residential
 */
const syncHandler: Handler = async (_event: HandlerEvent, _context: HandlerContext) => {
  console.log('Starting Jobber Residential sync...');

  const stats = await runSync();

  if (stats.errors.length > 0) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        errors: stats.errors,
        stats,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      message: 'Sync completed successfully',
      stats,
    }),
  };
};

// Schedule: Run at 2am CST (8am UTC) daily
export const handler = schedule('0 8 * * *', syncHandler);
