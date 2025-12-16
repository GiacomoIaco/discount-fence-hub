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

    // Search using paginated queries to scan all customers
    const searchLower = searchTerm.toLowerCase();
    const allMatches: any[] = [];
    let startPosition = 1;
    const batchSize = 1000;
    const maxBatches = 35; // Up to 35k customers

    for (let batch = 0; batch < maxBatches; batch++) {
      const query = encodeURIComponent(
        `SELECT Id, DisplayName, PrimaryEmailAddr, PrimaryPhone, ParentRef FROM Customer STARTPOSITION ${startPosition} MAXRESULTS ${batchSize}`
      );

      const response = await oauthClient.makeApiCall({
        url: `${baseUrl}/v3/company/${realmId}/query?query=${query}`,
        method: 'GET',
      });

      const result = response.json;
      const customers = result.QueryResponse?.Customer || [];

      if (customers.length === 0) break; // No more results

      // Filter matches
      const matches = customers.filter((c: any) =>
        c.DisplayName?.toLowerCase().includes(searchLower)
      );
      allMatches.push(...matches);

      // Stop early if we found enough matches
      if (allMatches.length >= 20) break;

      startPosition += batchSize;
    }

    // Format results
    const formatted = allMatches.slice(0, 20).map((c: any) => ({
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
