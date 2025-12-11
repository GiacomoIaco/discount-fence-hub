import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID!,
  clientSecret: process.env.QBO_CLIENT_SECRET!,
  environment: (process.env.QBO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  redirectUri: process.env.QBO_REDIRECT_URI!,
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Handles OAuth callback from QuickBooks
 * GET /.netlify/functions/qbo-callback?code=...&state=...&realmId=...
 *
 * Exchanges the authorization code for access/refresh tokens
 * Stores tokens in Supabase for future API calls
 */
export const handler: Handler = async (event) => {
  try {
    const url = `${event.headers.host || 'localhost'}${event.path}?${event.rawQuery}`;
    const fullUrl = `https://${url}`;

    console.log('QBO Callback received:', event.rawQuery);

    // Check for error response from Intuit
    if (event.queryStringParameters?.error) {
      console.error('QBO Auth Error:', event.queryStringParameters.error);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h1>❌ QuickBooks Connection Failed</h1>
              <p>Error: ${event.queryStringParameters.error}</p>
              <p>${event.queryStringParameters.error_description || ''}</p>
              <a href="/">Return to App</a>
            </body>
          </html>
        `,
      };
    }

    // Exchange authorization code for tokens
    const authResponse = await oauthClient.createToken(fullUrl);
    const token = authResponse.getJson();

    console.log('Token received for realmId:', token.realmId);

    // Calculate expiration timestamps
    const now = new Date();
    const accessTokenExpiresAt = new Date(now.getTime() + token.expires_in * 1000);
    const refreshTokenExpiresAt = new Date(now.getTime() + token.x_refresh_token_expires_in * 1000);

    // Store tokens in Supabase
    const { error: upsertError } = await supabase
      .from('qbo_tokens')
      .upsert({
        id: 'primary', // Single row for now, could support multiple companies later
        realm_id: token.realmId,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        access_token_expires_at: accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
        token_type: token.token_type,
        environment: process.env.QBO_ENVIRONMENT || 'sandbox',
        updated_at: now.toISOString(),
      }, {
        onConflict: 'id',
      });

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError);
      throw new Error(`Failed to store tokens: ${upsertError.message}`);
    }

    console.log('Tokens stored successfully');

    // Success page with redirect
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>✅ QuickBooks Connected!</h1>
            <p>Your QuickBooks account has been successfully connected.</p>
            <p><strong>Company ID (Realm):</strong> ${token.realmId}</p>
            <p><strong>Environment:</strong> ${process.env.QBO_ENVIRONMENT || 'sandbox'}</p>
            <p><strong>Access Token Expires:</strong> ${accessTokenExpiresAt.toLocaleString()}</p>
            <p><strong>Refresh Token Expires:</strong> ${refreshTokenExpiresAt.toLocaleDateString()} (100 days)</p>
            <br/>
            <a href="/" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
              Return to App
            </a>
            <br/><br/>
            <a href="/.netlify/functions/qbo-test" style="padding: 10px 20px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px;">
              Test API Connection
            </a>
          </body>
        </html>
      `,
    };
  } catch (error) {
    console.error('QBO Callback Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>❌ Connection Error</h1>
            <p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>
            <a href="/.netlify/functions/qbo-auth">Try Again</a>
          </body>
        </html>
      `,
    };
  }
};
