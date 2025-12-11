import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Test QuickBooks API connection
 * GET /.netlify/functions/qbo-test
 *
 * Fetches company info to verify the connection works
 */
export const handler: Handler = async () => {
  try {
    // Get stored tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('qbo_tokens')
      .select('*')
      .eq('id', 'primary')
      .single();

    if (tokenError || !tokenData) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h1>⚠️ Not Connected</h1>
              <p>No QuickBooks connection found. Please connect first.</p>
              <a href="/.netlify/functions/qbo-auth" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                Connect to QuickBooks
              </a>
            </body>
          </html>
        `,
      };
    }

    // Initialize OAuth client with stored tokens
    const oauthClient = new OAuthClient({
      clientId: process.env.QBO_CLIENT_ID!,
      clientSecret: process.env.QBO_CLIENT_SECRET!,
      environment: (tokenData.environment as 'sandbox' | 'production') || 'sandbox',
      redirectUri: process.env.QBO_REDIRECT_URI!,
    });

    // Set the token
    oauthClient.setToken({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expires_in: Math.floor((new Date(tokenData.access_token_expires_at).getTime() - Date.now()) / 1000),
      x_refresh_token_expires_in: Math.floor((new Date(tokenData.refresh_token_expires_at).getTime() - Date.now()) / 1000),
      realmId: tokenData.realm_id,
    });

    // Check if access token is expired and refresh if needed
    if (oauthClient.isAccessTokenValid() === false) {
      console.log('Access token expired, refreshing...');
      const refreshResponse = await oauthClient.refresh();
      const newToken = refreshResponse.getJson();

      // Update stored tokens
      const now = new Date();
      await supabase
        .from('qbo_tokens')
        .update({
          access_token: newToken.access_token,
          refresh_token: newToken.refresh_token,
          access_token_expires_at: new Date(now.getTime() + newToken.expires_in * 1000).toISOString(),
          refresh_token_expires_at: new Date(now.getTime() + newToken.x_refresh_token_expires_in * 1000).toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', 'primary');

      console.log('Tokens refreshed successfully');
    }

    // Make API call to get company info
    const baseUrl = tokenData.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const companyInfoUrl = `${baseUrl}/v3/company/${tokenData.realm_id}/companyinfo/${tokenData.realm_id}`;

    const response = await oauthClient.makeApiCall({
      url: companyInfoUrl,
      method: 'GET',
    });

    // response.text is a property, not a function in newer SDK versions
    const responseText = typeof response.text === 'function' ? response.text() : response.text;
    const companyInfo = JSON.parse(responseText);

    // Also get customer count (to test query capability)
    const customerCountUrl = `${baseUrl}/v3/company/${tokenData.realm_id}/query?query=SELECT COUNT(*) FROM Customer`;
    const customerCountResponse = await oauthClient.makeApiCall({
      url: customerCountUrl,
      method: 'GET',
    });
    const customerCountText = typeof customerCountResponse.text === 'function' ? customerCountResponse.text() : customerCountResponse.text;
    const customerCount = JSON.parse(customerCountText);

    const company = companyInfo.CompanyInfo;
    const count = customerCount.QueryResponse?.totalCount || 0;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
            <h1>✅ QuickBooks API Working!</h1>

            <h2>Company Info</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Company Name</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${company.CompanyName}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Legal Name</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${company.LegalName || 'N/A'}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Company ID</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${company.Id}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Country</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${company.Country}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Email</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${company.Email?.Address || 'N/A'}</td></tr>
            </table>

            <h2>API Stats</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Total Customers</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${count}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Environment</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${tokenData.environment}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Realm ID</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${tokenData.realm_id}</td></tr>
            </table>

            <h2>Token Status</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Access Token Expires</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(tokenData.access_token_expires_at).toLocaleString()}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Refresh Token Expires</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(tokenData.refresh_token_expires_at).toLocaleDateString()}</td></tr>
            </table>

            <br/>
            <a href="/" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
              Return to App
            </a>
          </body>
        </html>
      `,
    };
  } catch (error) {
    console.error('QBO Test Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>❌ API Test Failed</h1>
            <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
            <pre style="text-align: left; background: #f5f5f5; padding: 20px; overflow: auto;">${error instanceof Error ? error.stack : ''}</pre>
            <br/>
            <a href="/.netlify/functions/qbo-auth" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
              Reconnect to QuickBooks
            </a>
          </body>
        </html>
      `,
    };
  }
};
