import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Find customers with 3-level hierarchy (Client:Community:Job)
 * GET /.netlify/functions/qbo-find-3level
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

    // Get a sample of jobs and look for 3-level hierarchy
    const threeLevel: any[] = [];
    const twoLevel: any[] = [];
    let startPosition = 1;
    const batchSize = 1000;

    for (let batch = 0; batch < 5; batch++) {
      const query = encodeURIComponent(
        `SELECT Id, DisplayName, FullyQualifiedName, ParentRef FROM Customer WHERE Job = true STARTPOSITION ${startPosition} MAXRESULTS ${batchSize}`
      );

      const response = await oauthClient.makeApiCall({
        url: `${baseUrl}/v3/company/${realmId}/query?query=${query}`,
        method: 'GET',
      });

      const result = response.json;
      const customers = result.QueryResponse?.Customer || [];

      for (const c of customers) {
        const parts = (c.FullyQualifiedName || '').split(':');
        if (parts.length >= 3) {
          threeLevel.push({
            id: c.Id,
            displayName: c.DisplayName,
            fullyQualifiedName: c.FullyQualifiedName,
            parentRefId: c.ParentRef?.value,
            levels: parts.length,
          });
        } else if (parts.length === 2) {
          if (twoLevel.length < 10) {
            twoLevel.push({
              id: c.Id,
              fullyQualifiedName: c.FullyQualifiedName,
            });
          }
        }
      }

      if (customers.length < batchSize) break;
      startPosition += batchSize;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threeLevelCount: threeLevel.length,
        threeLevelSamples: threeLevel.slice(0, 20),
        twoLevelSampleCount: twoLevel.length,
        twoLevelSamples: twoLevel,
      }, null, 2),
    };

  } catch (error) {
    console.error('QBO Find 3-Level Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
