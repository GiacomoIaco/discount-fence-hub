import type { Handler } from '@netlify/functions';

const JOBBER_AUTH_URL = 'https://api.getjobber.com/api/oauth/authorize';

type JobberAccount = 'residential' | 'builders' | 'commercial';

const VALID_ACCOUNTS: JobberAccount[] = ['residential', 'builders', 'commercial'];

/**
 * Initiates Jobber OAuth flow
 * GET /.netlify/functions/jobber-auth?account=residential
 *
 * Query params:
 *   - account: 'residential' | 'builders' | 'commercial' (required)
 *
 * Redirects the user to Jobber's authorization page
 */
export const handler: Handler = async (event) => {
  try {
    const account = event.queryStringParameters?.account as JobberAccount;

    // Validate account type
    if (!account || !VALID_ACCOUNTS.includes(account)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h1>Invalid Account Type</h1>
              <p>Please specify which Jobber account to connect:</p>
              <div style="display: flex; flex-direction: column; gap: 10px; max-width: 300px; margin: 20px auto;">
                <a href="/.netlify/functions/jobber-auth?account=residential" style="padding: 15px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                  Connect Residential
                </a>
                <a href="/.netlify/functions/jobber-auth?account=builders" style="padding: 15px 20px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px;">
                  Connect Builders
                </a>
                <a href="/.netlify/functions/jobber-auth?account=commercial" style="padding: 15px 20px; background: #9333ea; color: white; text-decoration: none; border-radius: 5px;">
                  Connect Commercial
                </a>
              </div>
            </body>
          </html>
        `,
      };
    }

    // Check for required environment variables
    if (!process.env.JOBBER_CLIENT_ID || !process.env.JOBBER_CLIENT_SECRET) {
      console.error('Missing JOBBER_CLIENT_ID or JOBBER_CLIENT_SECRET');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Jobber OAuth not configured' }),
      };
    }

    // Generate state token for CSRF protection (includes account type)
    // Format: jobber_ACCOUNT_TIMESTAMP_RANDOM
    const state = `jobber_${account}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: process.env.JOBBER_CLIENT_ID,
      redirect_uri: process.env.JOBBER_REDIRECT_URI || `${process.env.URL}/.netlify/functions/jobber-callback`,
      response_type: 'code',
      state: state,
    });

    const authUrl = `${JOBBER_AUTH_URL}?${params.toString()}`;

    console.log(`Redirecting to Jobber auth for account: ${account}`);
    console.log(`Auth URL: ${authUrl}`);

    // Redirect user to Jobber's authorization page
    return {
      statusCode: 302,
      headers: {
        Location: authUrl,
        'Cache-Control': 'no-cache',
      },
      body: '',
    };
  } catch (error) {
    console.error('Jobber Auth Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>Error</h1>
            <p>${error instanceof Error ? error.message : 'Failed to initiate OAuth flow'}</p>
            <a href="/">Return to App</a>
          </body>
        </html>
      `,
    };
  }
};
