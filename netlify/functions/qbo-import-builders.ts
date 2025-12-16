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
 * Get COMMUNITY-level sub-customers for a parent.
 * Communities are direct children that have their own sub-customers (3-level hierarchy).
 * This filters out old-style jobs that are directly under the parent.
 */
async function getCommunitySubCustomers(
  oauthClient: OAuthClient,
  baseUrl: string,
  realmId: string,
  parentName: string
): Promise<QboCustomer[]> {
  const escapedName = parentName.replace(/'/g, "\\'");

  // Get ALL descendants
  const allDescendants: QboCustomer[] = [];
  let startPosition = 1;
  const batchSize = 500;

  for (let batch = 0; batch < 20; batch++) {
    const query = encodeURIComponent(
      `SELECT * FROM Customer WHERE FullyQualifiedName LIKE '${escapedName}:%' STARTPOSITION ${startPosition} MAXRESULTS ${batchSize}`
    );

    try {
      const response = await oauthClient.makeApiCall({
        url: `${baseUrl}/v3/company/${realmId}/query?query=${query}`,
        method: 'GET',
      });
      const result = response.json;
      const customers = result.QueryResponse?.Customer || [];
      allDescendants.push(...customers);

      if (customers.length < batchSize) break;
      startPosition += batchSize;
    } catch (error) {
      console.error(`Error getting descendants for ${parentName}:`, error);
      break;
    }
  }

  // Separate into direct children (2 parts) and grandchildren (3+ parts)
  const directChildren: QboCustomer[] = [];
  const grandchildPrefixes = new Set<string>();

  for (const customer of allDescendants) {
    const fqn = (customer as any).FullyQualifiedName || '';
    const parts = fqn.split(':');

    if (parts.length === 2) {
      // Direct child (e.g., "Perry Homes:Wolf Ranch" or "Perry Homes:100 Bole Cove")
      directChildren.push(customer);
    } else if (parts.length >= 3) {
      // Grandchild - record the parent (community) prefix
      // e.g., "Perry Homes:Wolf Ranch:J12345" -> "Perry Homes:Wolf Ranch"
      grandchildPrefixes.add(parts.slice(0, 2).join(':'));
    }
  }

  // Filter direct children to only those that have grandchildren (real communities)
  const communities = directChildren.filter(child => {
    const fqn = (child as any).FullyQualifiedName || '';
    return grandchildPrefixes.has(fqn);
  });

  console.log(`${parentName}: ${allDescendants.length} total descendants, ${directChildren.length} direct children, ${communities.length} communities (with sub-customers)`);

  return communities;
}

/**
 * Import builders from QBO into clients/communities tables
 * GET /.netlify/functions/qbo-import-builders?dryRun=true  (preview)
 * GET /.netlify/functions/qbo-import-builders              (execute)
 * GET /.netlify/functions/qbo-import-builders?builder=Perry%20Homes  (single builder)
 * GET /.netlify/functions/qbo-import-builders?batch=0      (batch 0 = first 10 builders)
 */
export const handler: Handler = async (event) => {
  const dryRun = event.queryStringParameters?.dryRun === 'true';
  const singleBuilder = event.queryStringParameters?.builder;
  const batchIndex = event.queryStringParameters?.batch ? parseInt(event.queryStringParameters.batch) : null;

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

    // Filter builders based on parameters
    let buildersToProcess = BUILDERS;

    if (singleBuilder) {
      // Process only a specific builder
      buildersToProcess = BUILDERS.filter(b => b.name === singleBuilder);
      if (buildersToProcess.length === 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: `Builder "${singleBuilder}" not found in list` }),
        };
      }
    } else if (batchIndex !== null) {
      // Process builders in batches of 10
      const batchSizeForParam = 10;
      const start = batchIndex * batchSizeForParam;
      buildersToProcess = BUILDERS.slice(start, start + batchSizeForParam);
      if (buildersToProcess.length === 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: `Batch ${batchIndex} is empty (only ${Math.ceil(BUILDERS.length / batchSizeForParam)} batches available)` }),
        };
      }
    }

    console.log(`${dryRun ? '[DRY RUN] ' : ''}Importing ${buildersToProcess.length} builders...`);

    const results: ImportResult[] = [];
    let totalClientsCreated = 0;
    let totalCommunitiesCreated = 0;
    let totalQboLinked = 0;

    // Process builders in batches of 5 for parallel processing
    const batchSize = 5;
    for (let i = 0; i < buildersToProcess.length; i += batchSize) {
      const batch = buildersToProcess.slice(i, i + batchSize);

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

            // If QBO linked, get and create communities (sub-customers that have their own sub-customers)
            if (qboCustomer) {
              const subCustomers = await getCommunitySubCustomers(oauthClient, baseUrl, realmId, builder.name);

              for (const sub of subCustomers) {
                // Extract community name (remove "Parent:" prefix)
                const communityName = sub.DisplayName.includes(':')
                  ? sub.DisplayName.split(':').slice(1).join(':').trim()
                  : sub.DisplayName;

                // Check if community already exists
                const { data: existingCommunity } = await supabase
                  .from('communities')
                  .select('id, quickbooks_id')
                  .eq('client_id', result.clientId)
                  .eq('name', communityName)
                  .single();

                if (existingCommunity) {
                  // Update existing community with QBO data if not already linked
                  if (!existingCommunity.quickbooks_id) {
                    await supabase
                      .from('communities')
                      .update({
                        quickbooks_id: sub.Id,
                        address_line1: sub.BillAddr?.Line1 || null,
                        city: sub.BillAddr?.City || null,
                        state: normalizeState(sub.BillAddr?.CountrySubDivisionCode),
                        zip: sub.BillAddr?.PostalCode || null,
                      })
                      .eq('id', existingCommunity.id);
                    result.communitiesCreated++; // Repurpose as "communities synced"
                    totalCommunitiesCreated++;
                  }
                } else {
                  // Create new community
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
              const subCustomers = await getCommunitySubCustomers(oauthClient, baseUrl, realmId, builder.name);
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
