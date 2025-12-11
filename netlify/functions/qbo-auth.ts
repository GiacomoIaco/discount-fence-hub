import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID!,
  clientSecret: process.env.QBO_CLIENT_SECRET!,
  environment: (process.env.QBO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  redirectUri: process.env.QBO_REDIRECT_URI!,
});

/**
 * Initiates QuickBooks OAuth flow
 * GET /.netlify/functions/qbo-auth
 *
 * Redirects the user to Intuit's authorization page
 */
export const handler: Handler = async (event) => {
  try {
    // Generate a state token for CSRF protection
    const state = `qbo_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Generate the authorization URL
    const authUri = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting], // com.intuit.quickbooks.accounting
      state: state,
    });

    console.log('Redirecting to QBO auth:', authUri);

    // Redirect user to Intuit's authorization page
    return {
      statusCode: 302,
      headers: {
        Location: authUri,
        'Cache-Control': 'no-cache',
      },
      body: '',
    };
  } catch (error) {
    console.error('QBO Auth Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to initiate OAuth flow',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
