import type { BackgroundHandler } from '@netlify/functions';
import { runFullSync, type JobberAccount } from './lib/jobber-sync-core';

/**
 * Background function for Jobber sync
 * Triggered by: POST /.netlify/functions/jobber-sync-background
 *
 * Body: { account?: 'residential' | 'builders' | 'commercial', mode?: 'full' | 'incremental' }
 */
export const handler: BackgroundHandler = async (event) => {
  const body = JSON.parse(event.body || '{}');
  const account = (body.account || 'residential') as JobberAccount;
  const forceFull = body.mode === 'full';

  console.log(`Background sync started for ${account} (requested mode: ${body.mode || 'auto'})`);

  const stats = await runFullSync(account, forceFull);

  if (stats.errors.length > 0) {
    console.error(`Background sync finished with errors: ${stats.errors.join(', ')}`);
  } else {
    console.log(
      `Background sync completed (${stats.syncMode}) in ${stats.duration.toFixed(1)}s: ` +
      `${stats.quotesProcessed} quotes, ${stats.jobsProcessed} jobs, ${stats.requestsProcessed} requests`
    );
  }
};
