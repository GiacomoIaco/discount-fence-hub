import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

type JobberAccount = 'residential' | 'builders' | 'commercial';

const ACCOUNTS: JobberAccount[] = ['residential', 'builders', 'commercial'];

const ACCOUNT_NAMES: Record<JobberAccount, string> = {
  residential: 'Discount Fence - Residential',
  builders: 'Discount Fence - Builders',
  commercial: 'Discount Fence - Commercial',
};

const ACCOUNT_COLORS: Record<JobberAccount, string> = {
  residential: '#2563eb',
  builders: '#16a34a',
  commercial: '#9333ea',
};

interface TokenRecord {
  id: string;
  account_name: string;
  account_id: string | null;
  access_token_expires_at: string;
  refresh_token_expires_at: string | null;
  updated_at: string;
}

interface SyncRecord {
  id: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_error: string | null;
  jobs_synced: number;
  quotes_synced: number;
  invoices_synced: number;
}

/**
 * Get status of all Jobber connections
 * GET /.netlify/functions/jobber-status
 * GET /.netlify/functions/jobber-status?format=json
 *
 * Returns HTML dashboard or JSON based on format param
 */
export const handler: Handler = async (event) => {
  try {
    const format = event.queryStringParameters?.format || 'html';

    // Get all tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('jobber_tokens')
      .select('id, account_name, account_id, access_token_expires_at, refresh_token_expires_at, updated_at')
      .order('id');

    if (tokensError) {
      throw tokensError;
    }

    // Get sync status
    const { data: syncStatus } = await supabase
      .from('jobber_sync_status')
      .select('*')
      .order('id');

    // Build status for each account
    const accountStatus = ACCOUNTS.map(acc => {
      const token = tokens?.find((t: TokenRecord) => t.id === acc);
      const sync = syncStatus?.find((s: SyncRecord) => s.id === acc);

      if (!token) {
        return {
          id: acc,
          name: ACCOUNT_NAMES[acc],
          color: ACCOUNT_COLORS[acc],
          connected: false,
        };
      }

      const now = new Date();
      const accessExpired = new Date(token.access_token_expires_at) < now;
      const refreshExpired = token.refresh_token_expires_at
        ? new Date(token.refresh_token_expires_at) < now
        : false;

      return {
        id: acc,
        name: token.account_name || ACCOUNT_NAMES[acc],
        color: ACCOUNT_COLORS[acc],
        connected: true,
        account_id: token.account_id,
        access_expired: accessExpired,
        refresh_expired: refreshExpired,
        access_token_expires_at: token.access_token_expires_at,
        refresh_token_expires_at: token.refresh_token_expires_at,
        last_updated: token.updated_at,
        last_sync: sync ? {
          at: sync.last_sync_at,
          status: sync.last_sync_status,
          error: sync.last_error,
          jobs: sync.jobs_synced,
          quotes: sync.quotes_synced,
          invoices: sync.invoices_synced,
        } : null,
      };
    });

    // Return JSON if requested
    if (format === 'json') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: accountStatus }),
      };
    }

    // Build HTML dashboard
    const accountCards = accountStatus.map(acc => {
      if (!acc.connected) {
        return `
          <div style="border: 2px dashed #d1d5db; border-radius: 8px; padding: 20px; text-align: center;">
            <h3 style="color: ${acc.color}; margin: 0 0 10px 0;">${acc.name}</h3>
            <p style="color: #6b7280; margin: 0 0 15px 0;">Not connected</p>
            <a href="/.netlify/functions/jobber-auth?account=${acc.id}"
               style="display: inline-block; padding: 8px 16px; background: ${acc.color}; color: white; text-decoration: none; border-radius: 5px;">
              Connect
            </a>
          </div>
        `;
      }

      const statusIcon = acc.refresh_expired ? '&#10008;' : acc.access_expired ? '&#9888;' : '&#10004;';
      const statusColor = acc.refresh_expired ? '#dc2626' : acc.access_expired ? '#f59e0b' : '#16a34a';
      const statusText = acc.refresh_expired ? 'Needs Reconnect' : acc.access_expired ? 'Token Expired (will refresh)' : 'Active';

      return `
        <div style="border: 2px solid ${acc.color}; border-radius: 8px; padding: 20px;">
          <h3 style="color: ${acc.color}; margin: 0 0 10px 0;">${acc.name}</h3>
          <p style="margin: 0 0 10px 0;">
            <span style="color: ${statusColor}; font-size: 1.2em;">${statusIcon}</span>
            <span style="margin-left: 5px;">${statusText}</span>
          </p>
          <table style="width: 100%; font-size: 0.9em;">
            <tr>
              <td style="color: #6b7280;">Jobber ID:</td>
              <td>${acc.account_id || 'N/A'}</td>
            </tr>
            <tr>
              <td style="color: #6b7280;">Access Expires:</td>
              <td>${new Date(acc.access_token_expires_at!).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color: #6b7280;">Last Updated:</td>
              <td>${new Date(acc.last_updated!).toLocaleString()}</td>
            </tr>
            ${acc.last_sync ? `
            <tr>
              <td style="color: #6b7280;">Last Sync:</td>
              <td>${acc.last_sync.at ? new Date(acc.last_sync.at).toLocaleString() : 'Never'}
                  (${acc.last_sync.status || 'N/A'})</td>
            </tr>
            ` : ''}
          </table>
          <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
            <a href="/.netlify/functions/jobber-test?account=${acc.id}"
               style="padding: 6px 12px; background: #16a34a; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em;">
              Test
            </a>
            <a href="/.netlify/functions/jobber-auth?account=${acc.id}"
               style="padding: 6px 12px; background: #6b7280; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em;">
              Reconnect
            </a>
          </div>
        </div>
      `;
    }).join('');

    const connectedCount = accountStatus.filter(a => a.connected).length;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <head>
            <title>Jobber Connection Status</title>
          </head>
          <body style="font-family: sans-serif; padding: 40px; max-width: 900px; margin: 0 auto;">
            <h1>Jobber Connection Status</h1>
            <p style="color: #6b7280;">
              ${connectedCount} of ${ACCOUNTS.length} accounts connected
            </p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin: 30px 0;">
              ${accountCards}
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <h2>Quick Links</h2>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <a href="/.netlify/functions/jobber-status?format=json"
                   style="padding: 10px 20px; background: #6b7280; color: white; text-decoration: none; border-radius: 5px;">
                  View as JSON
                </a>
                <a href="/"
                   style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                  Return to App
                </a>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  } catch (error) {
    console.error('Jobber Status Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
