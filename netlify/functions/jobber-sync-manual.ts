import type { Handler } from '@netlify/functions';
import {
  getAccessToken,
  graphqlQuery,
  buildQuotesQuery,
  buildJobsQuery,
  buildRequestsQuery,
  runFullSync,
  sleep,
  type JobberAccount,
  type SyncMode,
  type SyncConfig,
} from './lib/jobber-sync-core';

/**
 * Manual sync trigger with multiple modes:
 *
 * GET ?account=residential                  - Run sync directly
 * GET ?account=residential&test=1           - Quick API connection test
 * GET ?account=residential&diag=1           - Fetch 1 page of each entity
 * GET ?account=residential&async=1          - Trigger background function
 * GET ?account=residential&mode=full        - Force full sync
 */
export const handler: Handler = async (event) => {
  const account = (event.queryStringParameters?.account || 'residential') as JobberAccount;
  const isTest = event.queryStringParameters?.test === '1';
  const isDiag = event.queryStringParameters?.diag === '1';
  const runAsync = event.queryStringParameters?.async === '1';
  const requestedMode = event.queryStringParameters?.mode as SyncMode | undefined;

  // ── Test mode: quick API connection check ──
  if (isTest) {
    try {
      const accessToken = await getAccessToken(account);
      const testQuery = `query TestConnection { account { name } }`;
      const result = await graphqlQuery(accessToken, testQuery, account, 1, 500);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          mode: 'test',
          account,
          data: result.data,
          cost: result.cost,
          message: 'Connection test successful - API is accessible',
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          mode: 'test',
          account,
          error: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  // ── Diagnostic mode: fetch 1 page of each entity ──
  if (isDiag) {
    try {
      const accessToken = await getAccessToken(account);
      const startTime = Date.now();
      const diagConfig: SyncConfig = { mode: 'full' };

      // Test quotes query (1 page)
      console.log('Testing quotes query...');
      const quotesQuery = buildQuotesQuery(diagConfig)(null);
      const quotesResult = await graphqlQuery(accessToken, quotesQuery, account);
      const quotesData = (quotesResult.data as { quotes: { nodes: unknown[]; pageInfo: { hasNextPage: boolean } } }).quotes;

      await sleep(300);

      // Test jobs query (1 page)
      console.log('Testing jobs query...');
      const jobsQuery = buildJobsQuery(diagConfig)(null);
      const jobsResult = await graphqlQuery(accessToken, jobsQuery, account);
      const jobsData = (jobsResult.data as { jobs: { nodes: unknown[]; pageInfo: { hasNextPage: boolean } } }).jobs;

      await sleep(300);

      // Test requests query (1 page)
      console.log('Testing requests query...');
      const requestsQuery = buildRequestsQuery(diagConfig)(null);
      const requestsResult = await graphqlQuery(accessToken, requestsQuery, account);
      const requestsData = (requestsResult.data as { requests: { nodes: unknown[]; pageInfo: { hasNextPage: boolean } } }).requests;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          mode: 'diagnostic',
          account,
          duration: (Date.now() - startTime) / 1000,
          firstPage: {
            quotes: { count: quotesData.nodes.length, hasMore: quotesData.pageInfo.hasNextPage, cost: quotesResult.cost },
            jobs: { count: jobsData.nodes.length, hasMore: jobsData.pageInfo.hasNextPage, cost: jobsResult.cost },
            requests: { count: requestsData.nodes.length, hasMore: requestsData.pageInfo.hasNextPage, cost: requestsResult.cost },
          },
          message: 'First page of each entity fetched successfully',
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          mode: 'diagnostic',
          account,
          error: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  // ── Account validation ──
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

  // ── Async mode: trigger background function ──
  if (runAsync) {
    console.log(`Manual sync triggered for ${account} (async=true)...`);
    const bgUrl = `${process.env.URL || 'https://discount-fence-hub.netlify.app'}/.netlify/functions/jobber-sync-background`;

    try {
      const bgResponse = await fetch(bgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, mode: requestedMode || 'incremental' }),
      });

      if (bgResponse.status === 202) {
        return {
          statusCode: 202,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            message: 'Sync started in background. Check sync status for progress.',
            account,
          }),
        };
      } else {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: `Failed to start background sync: ${bgResponse.status}`,
          }),
        };
      }
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `Failed to trigger background sync: ${error instanceof Error ? error.message : String(error)}`,
        }),
      };
    }
  }

  // ── Normal mode: run sync directly ──
  console.log(`Manual sync triggered for ${account}...`);
  const stats = await runFullSync(account, requestedMode === 'full');

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
