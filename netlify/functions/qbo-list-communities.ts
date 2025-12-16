import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * List communities (3-level sub-customers) for a specific builder
 * GET /.netlify/functions/qbo-list-communities?builder=Perry%20Homes
 */
export const handler: Handler = async (event) => {
  const builderName = event.queryStringParameters?.builder;

  if (!builderName) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing ?builder= parameter' }),
    };
  }

  try {
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

    // Get ALL descendants
    const escapedName = builderName.replace(/'/g, "\\'");
    const allDescendants: any[] = [];
    let startPosition = 1;
    const batchSize = 500;

    for (let batch = 0; batch < 20; batch++) {
      const query = encodeURIComponent(
        `SELECT Id, DisplayName, FullyQualifiedName, ParentRef FROM Customer WHERE FullyQualifiedName LIKE '${escapedName}:%' STARTPOSITION ${startPosition} MAXRESULTS ${batchSize}`
      );

      const response = await oauthClient.makeApiCall({
        url: `${baseUrl}/v3/company/${realmId}/query?query=${query}`,
        method: 'GET',
      });
      const result = response.json;
      const customers = result.QueryResponse?.Customer || [];
      allDescendants.push(...customers);

      if (customers.length < batchSize) break;
      startPosition += batchSize;
    }

    // Separate by levels
    const twoLevel: any[] = [];
    const threeLevel: any[] = [];
    const grandchildPrefixes = new Set<string>();

    for (const customer of allDescendants) {
      const fqn = customer.FullyQualifiedName || '';
      const parts = fqn.split(':');

      if (parts.length === 2) {
        twoLevel.push({
          id: customer.Id,
          displayName: customer.DisplayName,
          fqn: fqn,
        });
      } else if (parts.length >= 3) {
        threeLevel.push({
          id: customer.Id,
          displayName: customer.DisplayName,
          fqn: fqn,
          communityName: parts[1], // The community is the 2nd part
        });
        grandchildPrefixes.add(parts.slice(0, 2).join(':'));
      }
    }

    // Find communities (direct children that have grandchildren)
    const communities = twoLevel.filter(child => grandchildPrefixes.has(child.fqn));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        builder: builderName,
        totalDescendants: allDescendants.length,
        twoLevelCount: twoLevel.length,
        threeLevelCount: threeLevel.length,
        communitiesFound: communities.length,
        communities: communities,
        // Sample of 3-level records to verify
        threeLevelSamples: threeLevel.slice(0, 10),
      }, null, 2),
    };

  } catch (error) {
    console.error('QBO List Communities Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
