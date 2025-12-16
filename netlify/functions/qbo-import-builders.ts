import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

// Builder data from spreadsheet
const BUILDERS = [
  { name: "512 Home Remodel", type: "custom_builder", allowProjToParent: true },
  { name: "Alta Vista Builders", type: "custom_builder", allowProjToParent: true },
  { name: "Arbogast Homes", type: "custom_builder", allowProjToParent: true },
  { name: "Ash Creek Homes, Inc", type: "large_builder", allowProjToParent: false },
  { name: "Ashton Oak Construction", type: "custom_builder", allowProjToParent: true },
  { name: "Ashton Woods Homes", type: "large_builder", allowProjToParent: false },
  { name: "Bryson MPC Holdings", type: "custom_builder", allowProjToParent: true },
  { name: "C2 Custom Building", type: "custom_builder", allowProjToParent: true },
  { name: "CastleRock Communities", type: "large_builder", allowProjToParent: false },
  { name: "Catalyst Construction", type: "custom_builder", allowProjToParent: true },
  { name: "Chesmar Homes", type: "large_builder", allowProjToParent: false },
  { name: "Clark Wilson Builders", type: "custom_builder", allowProjToParent: true },
  { name: "D.R. Horton", type: "large_builder", allowProjToParent: false },
  { name: "David Weekely Homes", type: "large_builder", allowProjToParent: false },
  { name: "Drees Custom Homes", type: "large_builder", allowProjToParent: false },
  { name: "Driftwood Golf Club Inc", type: "custom_builder", allowProjToParent: true },
  { name: "Empire Communities", type: "large_builder", allowProjToParent: false },
  { name: "Eppright Homes", type: "custom_builder", allowProjToParent: true },
  { name: "GFO Homes", type: "large_builder", allowProjToParent: false },
  { name: "Giddens Custom Homes", type: "large_builder", allowProjToParent: false },
  { name: "Golden Oak Build", type: "custom_builder", allowProjToParent: true },
  { name: "Grandview Custom Homes", type: "custom_builder", allowProjToParent: true },
  { name: "Group Three Builders", type: "custom_builder", allowProjToParent: true },
  { name: "Heyl Homes", type: "custom_builder", allowProjToParent: true },
  { name: "Highland Homes", type: "large_builder", allowProjToParent: false },
  { name: "Homebound Technolgies", type: "custom_builder", allowProjToParent: true },
  { name: "Landsea Homes", type: "large_builder", allowProjToParent: false },
  { name: "Lennar Homes", type: "large_builder", allowProjToParent: false },
  { name: "LGI Homes", type: "large_builder", allowProjToParent: false },
  { name: "Lux Endeavors", type: "custom_builder", allowProjToParent: true },
  { name: "M/I Homes", type: "large_builder", allowProjToParent: false },
  { name: "Masonwood Development", type: "large_builder", allowProjToParent: false },
  { name: "MHI Homes", type: "large_builder", allowProjToParent: false },
  { name: "Milestone Community Builders", type: "large_builder", allowProjToParent: false },
  { name: "Millennium Pools", type: "pool_company", allowProjToParent: true },
  { name: "Modern Homestead", type: "custom_builder", allowProjToParent: true },
  { name: "New Home Co.", type: "large_builder", allowProjToParent: false },
  { name: "Nexstep Homes, LLC dba Thurman Homes", type: "custom_builder", allowProjToParent: true },
  { name: "Perry Homes", type: "large_builder", allowProjToParent: false },
  { name: "Pulte Homes", type: "large_builder", allowProjToParent: false },
  { name: "Rausch Coleman", type: "custom_builder", allowProjToParent: true },
  { name: "Ricara Constructions LLC", type: "custom_builder", allowProjToParent: true },
  { name: "Richmond American", type: "large_builder", allowProjToParent: false },
  { name: "Robins Construction", type: "custom_builder", allowProjToParent: true },
  { name: "Scott Felder Homes", type: "large_builder", allowProjToParent: false },
  { name: "Sendero Homes", type: "custom_builder", allowProjToParent: true },
  { name: "Silverado Signature Homes", type: "custom_builder", allowProjToParent: true },
  { name: "Silverton Custom Homes", type: "custom_builder", allowProjToParent: true },
  { name: "Southerly Homes", type: "custom_builder", allowProjToParent: true },
  { name: "Starlight Homes", type: "large_builder", allowProjToParent: false },
  { name: "Thurman Homes", type: "custom_builder", allowProjToParent: true },
  { name: "Tri Pointe Homes", type: "large_builder", allowProjToParent: false },
  { name: "Two Ten Communities", type: "custom_builder", allowProjToParent: true },
  { name: "Westin Homes", type: "large_builder", allowProjToParent: false },
  { name: "Williams Homes", type: "custom_builder", allowProjToParent: true },
  { name: "Zach Savage Homes", type: "custom_builder", allowProjToParent: true },
  { name: "Hillwood Communities", type: "custom_builder", allowProjToParent: true },
];

interface QboCustomer {
  Id: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  ParentRef?: { value: string };
}

// Normalize state to 2-letter code
function normalizeState(state: string | undefined): string {
  if (!state) return 'TX';
  const s = state.trim();
  if (s.length <= 2) return s.toUpperCase();
  // Map common full state names
  const stateMap: Record<string, string> = {
    'texas': 'TX',
    'california': 'CA',
    'florida': 'FL',
    'new york': 'NY',
    'arizona': 'AZ',
    'colorado': 'CO',
    'georgia': 'GA',
    'illinois': 'IL',
    'michigan': 'MI',
    'north carolina': 'NC',
    'ohio': 'OH',
    'pennsylvania': 'PA',
    'tennessee': 'TN',
    'virginia': 'VA',
    'washington': 'WA',
  };
  return stateMap[s.toLowerCase()] || s.substring(0, 2).toUpperCase();
}

interface ImportResult {
  builderName: string;
  clientId: string | null;
  qboId: string | null;
  qboLinked: boolean;
  communitiesCreated: number;
  error?: string;
}

/**
 * Query QBO for a customer by exact name
 */
async function queryCustomerByName(
  oauthClient: OAuthClient,
  baseUrl: string,
  realmId: string,
  customerName: string
): Promise<QboCustomer | null> {
  const escapedName = customerName.replace(/'/g, "\\'");
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`);

  try {
    const response = await oauthClient.makeApiCall({
      url: `${baseUrl}/v3/company/${realmId}/query?query=${query}`,
      method: 'GET',
    });
    const result = response.json;
    const customers: QboCustomer[] = result.QueryResponse?.Customer || [];
    return customers.find(c => !c.ParentRef) || null;
  } catch (error) {
    console.error(`Error querying customer "${customerName}":`, error);
    return null;
  }
}

/**
 * Get all sub-customers for a parent
 */
async function getSubCustomers(
  oauthClient: OAuthClient,
  baseUrl: string,
  realmId: string,
  parentId: string
): Promise<QboCustomer[]> {
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE ParentRef = '${parentId}' MAXRESULTS 200`);

  try {
    const response = await oauthClient.makeApiCall({
      url: `${baseUrl}/v3/company/${realmId}/query?query=${query}`,
      method: 'GET',
    });
    const result = response.json;
    return result.QueryResponse?.Customer || [];
  } catch (error) {
    console.error(`Error getting sub-customers for ${parentId}:`, error);
    return [];
  }
}

/**
 * Import builders from QBO into clients/communities tables
 * GET /.netlify/functions/qbo-import-builders?dryRun=true  (preview)
 * GET /.netlify/functions/qbo-import-builders              (execute)
 */
export const handler: Handler = async (event) => {
  const dryRun = event.queryStringParameters?.dryRun === 'true';

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

    console.log(`${dryRun ? '[DRY RUN] ' : ''}Importing ${BUILDERS.length} builders...`);

    const results: ImportResult[] = [];
    let totalClientsCreated = 0;
    let totalCommunitiesCreated = 0;
    let totalQboLinked = 0;

    // Process builders in batches of 5 for parallel processing
    const batchSize = 5;
    for (let i = 0; i < BUILDERS.length; i += batchSize) {
      const batch = BUILDERS.slice(i, i + batchSize);

      const batchResults = await Promise.all(batch.map(async (builder) => {
        const result: ImportResult = {
          builderName: builder.name,
          clientId: null,
          qboId: null,
          qboLinked: false,
          communitiesCreated: 0,
        };

        try {
          // Query QBO for this builder
          const qboCustomer = await queryCustomerByName(oauthClient, baseUrl, realmId, builder.name);

          if (qboCustomer) {
            result.qboId = qboCustomer.Id;
            result.qboLinked = true;
          }

          // Create client data
          const clientData = {
            name: builder.name,
            business_unit: 'builders',
            client_type: builder.type,
            quickbooks_id: qboCustomer?.Id || null,
            primary_contact_email: qboCustomer?.PrimaryEmailAddr?.Address || null,
            primary_contact_phone: qboCustomer?.PrimaryPhone?.FreeFormNumber || null,
            address_line1: qboCustomer?.BillAddr?.Line1 || null,
            city: qboCustomer?.BillAddr?.City || null,
            state: normalizeState(qboCustomer?.BillAddr?.CountrySubDivisionCode),
            zip: qboCustomer?.BillAddr?.PostalCode || null,
            status: 'active',
            notes: `Imported from QBO. Type: ${builder.type}. Allow Proj to Parent: ${builder.allowProjToParent}`,
          };

          if (!dryRun) {
            // Check if client already exists
            const { data: existingClient } = await supabase
              .from('clients')
              .select('id')
              .eq('name', builder.name)
              .single();

            if (existingClient) {
              // Update existing client
              await supabase
                .from('clients')
                .update(clientData)
                .eq('id', existingClient.id);
              result.clientId = existingClient.id;
            } else {
              // Insert new client
              const { data: newClient, error: insertError } = await supabase
                .from('clients')
                .insert(clientData)
                .select('id')
                .single();

              if (insertError) {
                result.error = insertError.message;
                return result;
              }
              result.clientId = newClient.id;
              totalClientsCreated++;
            }

            // If QBO linked, get and create communities (sub-customers)
            if (qboCustomer) {
              const subCustomers = await getSubCustomers(oauthClient, baseUrl, realmId, qboCustomer.Id);

              for (const sub of subCustomers) {
                // Extract community name (remove "Parent:" prefix)
                const communityName = sub.DisplayName.includes(':')
                  ? sub.DisplayName.split(':').slice(1).join(':').trim()
                  : sub.DisplayName;

                // Check if community already exists
                const { data: existingCommunity } = await supabase
                  .from('communities')
                  .select('id')
                  .eq('client_id', result.clientId)
                  .eq('name', communityName)
                  .single();

                if (!existingCommunity) {
                  const { error: communityError } = await supabase
                    .from('communities')
                    .insert({
                      client_id: result.clientId,
                      name: communityName,
                      quickbooks_id: sub.Id,
                      address_line1: sub.BillAddr?.Line1 || null,
                      city: sub.BillAddr?.City || null,
                      state: normalizeState(sub.BillAddr?.CountrySubDivisionCode),
                      zip: sub.BillAddr?.PostalCode || null,
                      status: 'active',
                    });

                  if (!communityError) {
                    result.communitiesCreated++;
                    totalCommunitiesCreated++;
                  }
                }
              }
            }
          } else {
            // Dry run - just count what would be created
            result.clientId = 'dry-run';
            if (qboCustomer) {
              const subCustomers = await getSubCustomers(oauthClient, baseUrl, realmId, qboCustomer.Id);
              result.communitiesCreated = subCustomers.length;
            }
          }

          if (result.qboLinked) totalQboLinked++;

        } catch (error) {
          result.error = error instanceof Error ? error.message : 'Unknown error';
        }

        return result;
      }));

      results.push(...batchResults);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dryRun,
        summary: {
          totalBuilders: BUILDERS.length,
          clientsCreated: dryRun ? BUILDERS.length : totalClientsCreated,
          communitiesCreated: dryRun ? results.reduce((sum, r) => sum + r.communitiesCreated, 0) : totalCommunitiesCreated,
          qboLinked: totalQboLinked,
          notLinked: BUILDERS.length - totalQboLinked,
        },
        results,
      }, null, 2),
    };

  } catch (error) {
    console.error('QBO Import Builders Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
