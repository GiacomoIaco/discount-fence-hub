/**
 * Jobber Residential Sync - Nightly Cron
 *
 * Runs a full sync every night at 2am CST (8am UTC).
 * Always forces full sync because Jobs and Requests don't support
 * updatedAt filters, so incremental would miss status changes.
 *
 * All sync logic lives in ./lib/jobber-sync-core.ts
 */
import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { schedule } from '@netlify/functions';
import { runFullSync } from './lib/jobber-sync-core';

const syncHandler: Handler = async (_event: HandlerEvent, _context: HandlerContext) => {
  console.log('Starting Jobber Residential nightly sync...');

  const stats = await runFullSync('residential', true);

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
      message: 'Residential sync completed successfully',
      stats,
    }),
  };
};

// Schedule: Run at 2am CST (8am UTC) daily
export const handler = schedule('0 8 * * *', syncHandler);
