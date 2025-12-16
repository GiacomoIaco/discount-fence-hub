import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Debug sub-customers for a parent - tries both ParentRef and DisplayName approaches
 * GET /.netlify/functions/qbo-debug-subcustomers?name=Perry%20Homes
 */
export const handler: Handler = async (event) => {
  const parentName = event.queryStringParameters?.name;

  if (!parentName) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing ?name= parameter' }),
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

    const results: any = {
      parentName,
      approaches: {},
    };

    // 1. Find the parent customer first
    const escapedName = parentName.replace(/'/g, "\\'");
    const parentQuery = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`);

    const parentResponse = await oauthClient.makeApiCall({
      url: `${baseUrl}/v3/company/${realmId}/query?query=${parentQuery}`,
      method: 'GET',
    });

    const parentResult = parentResponse.json;
    const parents = parentResult.QueryResponse?.Customer || [];
    const parent = parents.find((c: any) => !c.ParentRef);

    results.parentFound = !!parent;
    results.parentId = parent?.Id;
    results.parentDisplayName = parent?.DisplayName;

    if (parent) {
      // 2. Try ParentRef approach (what import uses)
      const parentRefQuery = encodeURIComponent(`SELECT * FROM Customer WHERE ParentRef = '${parent.Id}' MAXRESULTS 50`);

      const parentRefResponse = await oauthClient.makeApiCall({
        url: `${baseUrl}/v3/company/${realmId}/query?query=${parentRefQuery}`,
        method: 'GET',
      });

      const parentRefResult = parentRefResponse.json;
      const parentRefCustomers = parentRefResult.QueryResponse?.Customer || [];

      results.approaches.parentRef = {
        query: `ParentRef = '${parent.Id}'`,
        count: parentRefCustomers.length,
        samples: parentRefCustomers.slice(0, 5).map((c: any) => ({
          id: c.Id,
          displayName: c.DisplayName,
          hasSubCustomers: c.Job === true,
        })),
      };

      // 3. Try DisplayName LIKE approach
      const likeQuery = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName LIKE '${escapedName}:%' MAXRESULTS 50`);

      const likeResponse = await oauthClient.makeApiCall({
        url: `${baseUrl}/v3/company/${realmId}/query?query=${likeQuery}`,
        method: 'GET',
      });

      const likeResult = likeResponse.json;
      const likeCustomers = likeResult.QueryResponse?.Customer || [];

      results.approaches.displayNameLike = {
        query: `DisplayName LIKE '${parentName}:%'`,
        count: likeCustomers.length,
        samples: likeCustomers.slice(0, 10).map((c: any) => ({
          id: c.Id,
          displayName: c.DisplayName,
          parentRefId: c.ParentRef?.value,
        })),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results, null, 2),
    };

  } catch (error) {
    console.error('QBO Debug Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
