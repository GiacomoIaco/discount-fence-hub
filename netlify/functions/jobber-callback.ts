import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

type JobberAccount = 'residential' | 'builders' | 'commercial';

const ACCOUNT_NAMES: Record<JobberAccount, string> = {
  residential: 'Discount Fence - Residential',
  builders: 'Discount Fence - Builders',
  commercial: 'Discount Fence - Commercial',
};

const ACCOUNT_COLORS: Record<JobberAccount, string> = {
  residential: '#2563eb', // blue
  builders: '#16a34a',    // green
  commercial: '#9333ea',  // purple
};

/**
 * Handles OAuth callback from Jobber
 * GET /.netlify/functions/jobber-callback?code=...&state=...
 *
 * Exchanges the authorization code for access/refresh tokens
 * Stores tokens in Supabase for future API calls
 */
export const handler: Handler = async (event) => {
  try {
    const { code, state, error, error_description } = event.queryStringParameters || {};

    // Check for error response from Jobber
    if (error) {
      console.error('Jobber Auth Error:', error, error_description);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h1 style="color: #dc2626;">&#10008; Jobber Connection Failed</h1>
              <p><strong>Error:</strong> ${error}</p>
              <p>${error_description || ''}</p>
              <br/>
              <a href="/" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                Return to App
              </a>
            </body>
          </html>
        `,
      };
    }

    if (!code) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h1 style="color: #dc2626;">&#10008; Missing Authorization Code</h1>
              <p>No authorization code received from Jobber.</p>
              <a href="/" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                Return to App
              </a>
            </body>
          </html>
        `,
      };
    }

    // Parse account type from state (format: jobber_ACCOUNT_timestamp_random)
    const stateParts = state?.split('_') || [];
    const account = (stateParts[1] || 'residential') as JobberAccount;

    console.log('Jobber Callback received:', { code: code.substring(0, 10) + '...', state, account });

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(JOBBER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: process.env.JOBBER_CLIENT_ID!,
        client_secret: process.env.JOBBER_CLIENT_SECRET!,
        redirect_uri: process.env.JOBBER_REDIRECT_URI || `${process.env.URL}/.netlify/functions/jobber-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorBody);
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorBody}`);
    }

    const token = await tokenResponse.json();

    console.log('Token received for account:', account);
    console.log('Token response keys:', Object.keys(token));

    // Calculate expiration timestamps
    // Jobber access tokens expire in 60 minutes (3600 seconds) by default
    const now = new Date();
    const expiresIn = token.expires_in || 3600;
    const accessTokenExpiresAt = new Date(now.getTime() + expiresIn * 1000);

    // Refresh token expiration (if provided)
    const refreshTokenExpiresAt = token.refresh_token_expires_in
      ? new Date(now.getTime() + token.refresh_token_expires_in * 1000)
      : null;

    // Store tokens in Supabase
    const { error: upsertError } = await supabase
      .from('jobber_tokens')
      .upsert({
        id: account,
        account_name: ACCOUNT_NAMES[account] || account,
        account_id: token.account_id || null,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        access_token_expires_at: accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt?.toISOString() || null,
        token_type: token.token_type || 'Bearer',
        scope: token.scope || null,
        updated_at: now.toISOString(),
      }, {
        onConflict: 'id',
      });

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError);
      throw new Error(`Failed to store tokens: ${upsertError.message}`);
    }

    // Initialize sync status record
    await supabase
      .from('jobber_sync_status')
      .upsert({
        id: account,
        last_sync_status: null,
        updated_at: now.toISOString(),
      }, {
        onConflict: 'id',
      });

    console.log(`Tokens stored successfully for ${account}`);

    const accountColor = ACCOUNT_COLORS[account] || '#2563eb';

    // Success page with redirect
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #16a34a;">&#10004; Jobber Connected!</h1>
            <p style="font-size: 1.2em;">
              <span style="display: inline-block; padding: 5px 15px; background: ${accountColor}; color: white; border-radius: 20px;">
                ${ACCOUNT_NAMES[account] || account}
              </span>
            </p>
            <br/>
            <table style="margin: 0 auto; text-align: left; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Account Type</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${account}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Access Token Expires</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${accessTokenExpiresAt.toLocaleString()}</td>
              </tr>
              ${refreshTokenExpiresAt ? `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Refresh Token Expires</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${refreshTokenExpiresAt.toLocaleDateString()}</td>
              </tr>
              ` : ''}
            </table>
            <br/><br/>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
              <a href="/.netlify/functions/jobber-test?account=${account}" style="padding: 10px 20px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px;">
                Test API Connection
              </a>
              <a href="/.netlify/functions/jobber-status" style="padding: 10px 20px; background: #6b7280; color: white; text-decoration: none; border-radius: 5px;">
                View All Connections
              </a>
              <a href="/" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                Return to App
              </a>
            </div>
          </body>
        </html>
      `,
    };
  } catch (error) {
    console.error('Jobber Callback Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #dc2626;">&#10008; Connection Error</h1>
            <p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>
            <pre style="text-align: left; background: #f5f5f5; padding: 20px; overflow: auto; max-width: 600px; margin: 20px auto;">
${error instanceof Error ? error.stack : ''}
            </pre>
            <a href="/.netlify/functions/jobber-auth" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
              Try Again
            </a>
          </body>
        </html>
      `,
    };
  }
};
