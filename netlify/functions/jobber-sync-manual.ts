import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
const PAGE_SIZE = 50; // Reduced from 100 to lower query cost

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

type JobberAccount = 'residential' | 'builders' | 'commercial';

interface SyncStats {
  quotesProcessed: number;
  jobsProcessed: number;
  requestsProcessed: number;
  opportunitiesComputed: number;
  errors: string[];
  duration: number;
}

/**
 * Refresh Jobber access token
 */
async function refreshToken(account: string, refreshTokenValue: string): Promise<string> {
  console.log(`Refreshing token for ${account}...`);

  // Check for required environment variables
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

  // Update stored tokens
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
 * Get valid access token (refreshing if expired or about to expire)
 */
async function getAccessToken(account: string): Promise<string> {
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
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  // Proactively refresh if expiring within 5 minutes (sync may take a while)
  const isExpiredOrExpiringSoon = expiresAt < fiveMinutesFromNow;

  if (isExpiredOrExpiringSoon) {
    console.log(`Access token ${expiresAt < now ? 'expired' : 'expiring soon'}, refreshing...`);
    return refreshToken(account, tokenData.refresh_token);
  }

  console.log(`Token valid until ${expiresAt.toISOString()}`);
  return tokenData.access_token;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make GraphQL query to Jobber API with retry logic and rate limit handling
 */
async function graphqlQuery(
  accessToken: string,
  query: string,
  retries: number = 5, // Increased from 3 to handle throttling better
  baseDelayMs: number = 1000
): Promise<{ data: unknown; cost?: { requestedQueryCost: number; actualQueryCost: number; throttleStatus: string } }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    console.log(`GraphQL attempt ${attempt + 1}/${retries}...`);
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
        lastError = new Error(`Rate limited (429)`);
        console.warn(`Rate limited (429). Waiting ${waitTime}ms before retry ${attempt + 1}/${retries}...`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP ${response.status} response:`, errorText.substring(0, 500));

        // Check for auth errors that shouldn't be retried
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Auth error: ${response.status} - ${errorText}`);
        }

        // Other errors - retry with backoff
        lastError = new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
        console.warn(`Request failed (${response.status}). Retry ${attempt + 1}/${retries}...`);
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }

      const responseText = await response.text();
      console.log(`Response length: ${responseText.length} chars`);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', responseText.substring(0, 500));
        lastError = new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }

      // Check for throttled status in extensions
      const cost = result.extensions?.cost;
      if (cost) {
        console.log(`Query cost: ${cost.actualQueryCost}/${cost.requestedQueryCost}, Status: ${cost.throttleStatus}`);

        // If we're being throttled, wait before continuing
        if (cost.throttleStatus === 'THROTTLED') {
          const waitTime = baseDelayMs * Math.pow(2, attempt);
          console.warn(`Throttled by Jobber. Waiting ${waitTime}ms...`);
          await sleep(waitTime);
        }
      }

      // Check for GraphQL-level errors
      if (result.errors) {
        const errorMessages = result.errors.map((e: { message?: string }) => e.message || 'Unknown').join(', ');

        // Check for rate limit errors in GraphQL response
        const isThrottled = result.errors.some((e: { message?: string; extensions?: { code?: string } }) =>
          e.message?.toLowerCase().includes('throttl') ||
          e.extensions?.code === 'THROTTLED'
        );

        if (isThrottled) {
          // Throttled - wait longer (at least 3 seconds, increasing with attempts)
          const waitTime = Math.max(3000, baseDelayMs * Math.pow(2, attempt + 1));
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

        console.error('GraphQL errors:', JSON.stringify(result.errors, null, 2));
        throw new Error(`GraphQL errors: ${errorMessages}`);
      }

      // Validate we got data
      if (!result.data) {
        console.error('No data in response:', JSON.stringify(result, null, 2).substring(0, 500));
        lastError = new Error('GraphQL response missing data field');
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }

      console.log('GraphQL request successful');
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
        console.warn(`Request error: ${lastError.message}. Waiting ${waitTime}ms before retry ${attempt + 1}/${retries}...`);
        await sleep(waitTime);
      }
    }
  }

  // Preserve the actual error message
  throw new Error(`GraphQL request failed after ${retries} retries: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Fetch all pages of a GraphQL query with adaptive rate limiting
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
  let consecutiveThrottles = 0;
  let delayMs = 1000; // Start with 1 second between requests to avoid throttling

  while (hasMore) {
    pageNum++;
    console.log(`Fetching page ${pageNum}...`);

    const query = queryBuilder(cursor);
    const result = await graphqlQuery(accessToken, query);

    let nodes: T[];
    let pageInfo: { hasNextPage: boolean; endCursor: string | null };
    try {
      const extracted = extractData(result.data);
      nodes = extracted.nodes;
      pageInfo = extracted.pageInfo;
    } catch (extractError) {
      const errorMsg = extractError instanceof Error ? extractError.message : String(extractError);
      console.error('Failed to extract data from response:', errorMsg);
      console.error('Response data:', JSON.stringify(result.data, null, 2).substring(0, 1000));
      throw new Error(`Failed to extract data from GraphQL response: ${errorMsg}`);
    }

    allItems.push(...nodes);

    hasMore = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    // Adaptive rate limiting based on cost feedback
    if (result.cost?.throttleStatus === 'THROTTLED') {
      consecutiveThrottles++;
      delayMs = Math.min(delayMs * 2, 5000); // Double delay up to 5 seconds
      console.warn(`Throttled - increasing delay to ${delayMs}ms`);
    } else if (consecutiveThrottles > 0) {
      consecutiveThrottles = 0;
      // Gradually reduce delay when not throttled
      delayMs = Math.max(delayMs * 0.8, 500);
    }

    // Wait between requests to avoid rate limits
    if (hasMore) {
      await sleep(delayMs);
    }
  }

  console.log(`Fetched ${allItems.length} items in ${pageNum} pages`);
  return allItems;
}

// ============================================
// SYNC FUNCTIONS (same as scheduled version)
// ============================================

// Simplified query - removed expensive nested connections (jobs.nodes, phones, emails)
// to reduce query cost and avoid throttling
const QUOTES_QUERY = (cursor: string | null) => `
  query SyncQuotes {
    quotes(first: ${PAGE_SIZE}${cursor ? `, after: "${cursor}"` : ''}) {
      nodes {
        id
        quoteNumber
        title
        quoteStatus
        amounts {
          total
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
        lastTransitioned {
          approvedAt
          convertedAt
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
  sentAt?: string;
  lastTransitioned?: {
    approvedAt?: string;
    convertedAt?: string;
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

  for (let i = 0; i < quotes.length; i += 100) {
    const batch = quotes.slice(i, i + 100);

    const records = batch.map((q) => {
      const addr = q.property?.address || q.client?.billingAddress;

      return {
        jobber_id: q.id,
        quote_number: q.quoteNumber,
        title: q.title,
        status: q.quoteStatus?.toLowerCase().replace(/_/g, '_'),
        total: q.amounts?.total || 0,
        subtotal: q.amounts?.subtotal || 0,
        discount: q.amounts?.discountAmount || 0,
        client_jobber_id: q.client?.id,
        client_name: q.client?.name,
        // Removed: client_email, client_phone, job_jobber_ids (too expensive to query)
        service_street: addr?.street,
        service_city: addr?.city,
        service_state: addr?.province,
        service_zip: addr?.postalCode,
        drafted_at: q.createdAt,
        sent_at: q.sentAt,
        approved_at: q.lastTransitioned?.approvedAt,
        converted_at: q.lastTransitioned?.convertedAt,
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

  for (let i = 0; i < jobs.length; i += 100) {
    const batch = jobs.slice(i, i + 100);

    const records = batch.map((j) => {
      const addr = j.property?.address;

      return {
        jobber_id: j.id,
        job_number: j.jobNumber,
        title: j.title,
        status: j.jobStatus?.toLowerCase().replace(/_/g, '_'),
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

// Simplified query - removed expensive nested quotes connection
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
}

async function syncRequests(accessToken: string): Promise<number> {
  console.log('Syncing requests...');

  const requests = await fetchAllPages<JobberRequest>(
    accessToken,
    REQUESTS_QUERY,
    (data) => (data as { requests: { nodes: JobberRequest[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).requests
  );

  console.log(`Processing ${requests.length} requests...`);

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
        // Removed: quote_jobber_ids (too expensive to query, link via quote.request_id instead)
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
// MAIN HANDLER
// ============================================

async function runSync(account: JobberAccount): Promise<SyncStats> {
  const stats: SyncStats = {
    quotesProcessed: 0,
    jobsProcessed: 0,
    requestsProcessed: 0,
    opportunitiesComputed: 0,
    errors: [],
    duration: 0,
  };

  const startTime = Date.now();

  try {
    // Mark sync as in progress
    await supabase
      .from('jobber_sync_status')
      .upsert({
        id: account,
        last_sync_status: 'in_progress',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    // Get access token
    console.log('Getting access token...');
    const accessToken = await getAccessToken(account);
    console.log('Access token obtained successfully');

    // Test connection with a simple query first
    console.log('Testing API connection...');
    const testQuery = `query TestConnection { account { name } }`;
    try {
      const testResult = await graphqlQuery(accessToken, testQuery, 1, 500);
      console.log('API connection test successful:', JSON.stringify(testResult.data));

      // Wait 2 seconds after test to let rate limit points restore
      // (Jobber restores 500 points/second, our queries cost ~500-1000 points each)
      console.log('Waiting 2s for rate limit points to restore...');
      await sleep(2000);
    } catch (testError) {
      const errorMsg = testError instanceof Error ? testError.message : String(testError);
      console.error('API connection test failed:', errorMsg);
      throw new Error(`Jobber API connection failed: ${errorMsg}`);
    }

    // Sync all data
    console.log('Starting data sync...');
    stats.quotesProcessed = await syncQuotes(accessToken);
    stats.jobsProcessed = await syncJobs(accessToken);
    stats.requestsProcessed = await syncRequests(accessToken);

    // Compute opportunities (only for residential for now)
    if (account === 'residential') {
      stats.opportunitiesComputed = await computeOpportunities();
    }

    stats.duration = (Date.now() - startTime) / 1000;

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
      .eq('id', account);

    console.log(`Sync completed in ${stats.duration.toFixed(1)}s`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);
    stats.duration = (Date.now() - startTime) / 1000;
    console.error('Sync failed:', errorMessage);

    // Mark sync as failed
    await supabase
      .from('jobber_sync_status')
      .update({
        last_sync_status: 'failed',
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account);
  }

  return stats;
}

/**
 * Manual sync trigger
 * GET /.netlify/functions/jobber-sync-manual?account=residential
 *
 * Can be used to test sync without waiting for schedule
 */
export const handler: Handler = async (event) => {
  const account = (event.queryStringParameters?.account || 'residential') as JobberAccount;

  // Only allow residential for now (others not yet set up)
  if (account !== 'residential') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: `Account "${account}" is not yet configured. Only "residential" is supported.`,
      }),
    };
  }

  console.log(`Manual sync triggered for ${account}...`);

  const stats = await runSync(account);

  if (stats.errors.length > 0) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        account,
        errors: stats.errors,
        stats: {
          quotesProcessed: stats.quotesProcessed,
          jobsProcessed: stats.jobsProcessed,
          requestsProcessed: stats.requestsProcessed,
          opportunitiesComputed: stats.opportunitiesComputed,
          durationSeconds: stats.duration,
        },
      }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      message: `Sync completed successfully for ${account}`,
      stats: {
        quotesProcessed: stats.quotesProcessed,
        jobsProcessed: stats.jobsProcessed,
        requestsProcessed: stats.requestsProcessed,
        opportunitiesComputed: stats.opportunitiesComputed,
        durationSeconds: stats.duration,
      },
    }),
  };
};
