import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Search QBO customers by partial name
 * GET /.netlify/functions/qbo-search-customer?q=Perry
 */
export const handler: Handler = async (event) => {
  try {
    const searchTerm = event.queryStringParameters?.q;

    if (!searchTerm) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing ?q= search parameter' }),
      };
    }

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

    // Search for customers with LIKE query
    const query = encodeURIComponent(`SELECT Id, DisplayName, CompanyName, PrimaryEmailAddr, PrimaryPhone, BillAddr, ParentRef FROM Customer WHERE DisplayName LIKE '%${searchTerm}%' MAXRESULTS 20`);

    const response = await oauthClient.makeApiCall({
      url: `${baseUrl}/v3/company/${realmId}/query?query=${query}`,
      method: 'GET',
    });

    const result = response.json;
    const customers = result.QueryResponse?.Customer || [];

    // Format results
    const formatted = customers.map((c: any) => ({
      id: c.Id,
      displayName: c.DisplayName,
      isSubCustomer: !!c.ParentRef,
      parentId: c.ParentRef?.value,
      email: c.PrimaryEmailAddr?.Address,
      phone: c.PrimaryPhone?.FreeFormNumber,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchTerm,
        count: formatted.length,
        results: formatted,
      }, null, 2),
    };

  } catch (error) {
    console.error('QBO Search Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
