import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Check sub-customers for a specific parent customer
 * GET /.netlify/functions/qbo-check-subcustomers?parentId=4
 * GET /.netlify/functions/qbo-check-subcustomers?name=Highland%20Homes
 */
export const handler: Handler = async (event) => {
  const parentId = event.queryStringParameters?.parentId;
  const parentName = event.queryStringParameters?.name;

  if (!parentId && !parentName) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing ?parentId= or ?name= parameter' }),
    };
  }

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Not connected to QuickBooks' }),
      };
    }

    // Initialize OAuth client
    const oauthClient = new OAuthClient({
      clientId: process.env.QBO_CLIENT_ID!,
      clientSecret: process.env.QBO_CLIENT_SECRET!,
      environment: (tokenData.environment as 'sandbox' | 'production') || 'sandbox',
      redirectUri: process.env.QBO_REDIRECT_URI!,
    });

    oauthClient.setToken({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expires_in: Math.floor((new Date(tokenData.access_token_expires_at).getTime() - Date.now()) / 1000),
      x_refresh_token_expires_in: Math.floor((new Date(tokenData.refresh_token_expires_at).getTime() - Date.now()) / 1000),
      realmId: tokenData.realm_id,
    });

    // Refresh token if needed
    if (!oauthClient.isAccessTokenValid()) {
      const refreshResponse = await oauthClient.refresh();
      const newToken = refreshResponse.getJson();
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
    }

    const baseUrl = tokenData.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
    const realmId = tokenData.realm_id;

    let resolvedParentId = parentId;
    let parentInfo: any = null;

    // If name provided, look up the parent first
    if (parentName && !parentId) {
      const escapedName = parentName.replace(/'/g, "\\'");
      const nameQuery = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`);

      const nameResponse = await oauthClient.makeApiCall({
        url: `${baseUrl}/v3/company/${realmId}/query?query=${nameQuery}`,
        method: 'GET',
      });

      const nameResult = nameResponse.json;
      const customers = nameResult.QueryResponse?.Customer || [];
      const parent = customers.find((c: any) => !c.ParentRef);

      if (!parent) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: `Parent customer "${parentName}" not found` }),
        };
      }

      resolvedParentId = parent.Id;
      parentInfo = {
        id: parent.Id,
        displayName: parent.DisplayName,
        companyName: parent.CompanyName,
      };
    }

    // Query for sub-customers
    const query = encodeURIComponent(`SELECT * FROM Customer WHERE ParentRef = '${resolvedParentId}' MAXRESULTS 500`);

    const response = await oauthClient.makeApiCall({
      url: `${baseUrl}/v3/company/${realmId}/query?query=${query}`,
      method: 'GET',
    });

    const result = response.json;
    const subCustomers = result.QueryResponse?.Customer || [];

    // Format results
    const formatted = subCustomers.map((c: any) => ({
      id: c.Id,
      displayName: c.DisplayName,
      // Extract just the community name (after the colon)
      communityName: c.DisplayName.includes(':')
        ? c.DisplayName.split(':').slice(1).join(':').trim()
        : c.DisplayName,
      email: c.PrimaryEmailAddr?.Address,
      city: c.BillAddr?.City,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentId: resolvedParentId,
        parentInfo,
        subCustomerCount: formatted.length,
        subCustomers: formatted,
      }, null, 2),
    };

  } catch (error) {
    console.error('QBO Check Sub-customers Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
