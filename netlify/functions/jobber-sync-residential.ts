/**
 * Jobber Residential Sync - Nightly Cron (Lightweight Trigger)
 *
 * Runs at 2am CST (8am UTC) daily.
 * Delegates actual sync to jobber-sync-background (15-min timeout).
 *
 * Why: Netlify scheduled functions have a hard 30s timeout regardless of
 * netlify.toml config. A full sync takes 10+ minutes. This function just
 * POSTs to the background function and returns immediately (<1s).
 */
import type { Config, Context } from '@netlify/functions';
import { markCronTriggered } from './lib/jobber-sync-core';

export default async function handler(req: Request, context: Context) {
  console.log('[cron] Jobber Residential nightly sync triggered at', new Date().toISOString());

  try {
    // Log that the cron fired (for observability, independent of sync success)
    await markCronTriggered('residential');

    // Delegate to background function (15-min timeout)
    const bgUrl = new URL('/.netlify/functions/jobber-sync-background', req.url);
    const response = await fetch(bgUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'residential', mode: 'full' }),
    });

    console.log(`[cron] Background function invoked, status: ${response.status}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Background sync triggered',
      backgroundStatus: response.status,
      triggeredAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cron] Failed to trigger background sync:', message);

    return new Response(JSON.stringify({
      success: false,
      error: message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Modern Netlify scheduled function config
export const config: Config = {
  schedule: '0 8 * * *', // 8am UTC = 2am CST daily
};
