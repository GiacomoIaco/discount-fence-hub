import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

interface QboClass {
  Id: string;
  Name: string;
  FullyQualifiedName?: string;
  ParentRef?: { value: string };
  Active: boolean;
}

interface SyncStats {
  fetched: number;
  created: number;
  updated: number;
  deactivated: number;
}

/**
 * Sync QBO Classes to local database
 * GET /.netlify/functions/qbo-sync-classes - Fetch and sync all classes
 *
 * Returns JSON with sync stats and list of classes
 */
export const handler: Handler = async (event) => {
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
        body: JSON.stringify({
          success: false,
          error: 'Not connected to QuickBooks. Visit /qbo-auth first.'
        }),
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
      console.log('Refreshing access token...');
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

    // Query all classes from QBO
    // Note: Query includes both active and inactive to track status changes
    const query = encodeURIComponent('SELECT * FROM Class MAXRESULTS 1000');

    const response = await oauthClient.makeApiCall({
      url: `${baseUrl}/v3/company/${realmId}/query?query=${query}`,
      method: 'GET',
    });

    const result = response.json;
    const queryResponse = result.QueryResponse || result.queryResponse || result;
    const qboClasses: QboClass[] = queryResponse.Class || queryResponse.class || [];

    console.log(`Fetched ${qboClasses.length} classes from QBO`);

    // Get existing classes from our database
    const { data: existingClasses } = await supabase
      .from('qbo_classes')
      .select('id, is_selectable');

    const existingMap = new Map((existingClasses || []).map(c => [c.id, c]));
    const fetchedIds = new Set(qboClasses.map(c => c.Id));

    const stats: SyncStats = {
      fetched: qboClasses.length,
      created: 0,
      updated: 0,
      deactivated: 0,
    };

    const syncedAt = new Date().toISOString();

    // Upsert each class
    for (const qboClass of qboClasses) {
      const existing = existingMap.get(qboClass.Id);

      const classData = {
        id: qboClass.Id,
        name: qboClass.Name,
        fully_qualified_name: qboClass.FullyQualifiedName || qboClass.Name,
        parent_id: qboClass.ParentRef?.value || null,
        is_active: qboClass.Active,
        // Preserve is_selectable if it exists, otherwise default to true
        is_selectable: existing?.is_selectable ?? true,
        synced_at: syncedAt,
      };

      const { error } = await supabase
        .from('qbo_classes')
        .upsert(classData, { onConflict: 'id' });

      if (error) {
        console.error(`Error upserting class ${qboClass.Id}:`, error);
      } else if (existing) {
        stats.updated++;
      } else {
        stats.created++;
      }
    }

    // Mark classes that no longer exist in QBO as inactive
    for (const [id] of existingMap) {
      if (!fetchedIds.has(id)) {
        await supabase
          .from('qbo_classes')
          .update({ is_active: false, synced_at: syncedAt })
          .eq('id', id);
        stats.deactivated++;
      }
    }

    // Fetch final state to return
    const { data: syncedClasses } = await supabase
      .from('qbo_classes')
      .select('*')
      .eq('is_active', true)
      .order('fully_qualified_name');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        stats,
        classes: syncedClasses,
      }),
    };
  } catch (error) {
    console.error('QBO Sync Classes Error:', error);

    let errorDetails = error instanceof Error ? error.message : 'Unknown error';
    if ((error as any).response?.json) {
      errorDetails = JSON.stringify((error as any).response.json, null, 2);
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: errorDetails,
      }),
    };
  }
};
