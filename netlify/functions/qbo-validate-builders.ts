import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

// Builder names from spreadsheet
const BUILDER_NAMES = [
  "512 Home Remodel",
  "Alta Vista Builders",
  "Arbogast Homes",
  "Ash Creek Homes, Inc",
  "Ashton Oak Construction",
  "Ashton Woods Homes",
  "Bryson MPC Holdings",
  "C2 Custom Building",
  "CastleRock Communities",
  "Catalyst Construction",
  "Chesmar Homes",
  "Clark Wilson Builders",
  "D.R. Horton",
  "David Weekely Homes",
  "Drees Custom Homes",
  "Driftwood Golf Club Inc",
  "Empire Communities",
  "Eppright Homes",
  "GFO Homes",
  "Giddens Custom Homes",
  "Golden Oak Build",
  "Grandview Custom Homes",
  "Group Three Builders",
  "Heyl Homes",
  "Highland Homes",
  "Homebound Technolgies",
  "Landsea Homes",
  "Lennar Homes",
  "LGI Homes",
  "Lux Endeavors",
  "M/I Homes",
  "Masonwood Development",
  "MHI Homes",
  "Milestone Community Builders",
  "Millennium Pools",
  "Modern Homestead",
  "New Home Co.",
  "Nexstep Homes, LLC dba Thurman Homes",
  "Perry Homes",
  "Pulte Homes",
  "Rausch Coleman",
  "Ricara Constructions LLC",
  "Richmond American",
  "Robins Construction",
  "Scott Felder Homes",
  "Sendero Homes",
  "Silverado Signature Homes",
  "Silverton Custom Homes",
  "Southerly Homes",
  "Starlight Homes",
  "Thurman Homes",
  "Tri Pointe Homes",
  "Two Ten Communities",
  "Westin Homes",
  "Williams Homes",
  "Zach Savage Homes",
  "Hillwood Communities"
];

// Builder metadata from spreadsheet
const BUILDER_METADATA: Record<string, { type: string; allowProjToParent: boolean }> = {
  "512 Home Remodel": { type: "custom_builder", allowProjToParent: true },
  "Alta Vista Builders": { type: "custom_builder", allowProjToParent: true },
  "Arbogast Homes": { type: "custom_builder", allowProjToParent: true },
  "Ash Creek Homes, Inc": { type: "large_builder", allowProjToParent: false },
  "Ashton Oak Construction": { type: "custom_builder", allowProjToParent: true },
  "Ashton Woods Homes": { type: "large_builder", allowProjToParent: false },
  "Bryson MPC Holdings": { type: "custom_builder", allowProjToParent: true },
  "C2 Custom Building": { type: "custom_builder", allowProjToParent: true },
  "CastleRock Communities": { type: "large_builder", allowProjToParent: false },
  "Catalyst Construction": { type: "custom_builder", allowProjToParent: true },
  "Chesmar Homes": { type: "large_builder", allowProjToParent: false },
  "Clark Wilson Builders": { type: "custom_builder", allowProjToParent: true },
  "D.R. Horton": { type: "large_builder", allowProjToParent: false },
  "David Weekely Homes": { type: "large_builder", allowProjToParent: false },
  "Drees Custom Homes": { type: "large_builder", allowProjToParent: false },
  "Driftwood Golf Club Inc": { type: "custom_builder", allowProjToParent: true },
  "Empire Communities": { type: "large_builder", allowProjToParent: false },
  "Eppright Homes": { type: "custom_builder", allowProjToParent: true },
  "GFO Homes": { type: "large_builder", allowProjToParent: false },
  "Giddens Custom Homes": { type: "large_builder", allowProjToParent: false },
  "Golden Oak Build": { type: "custom_builder", allowProjToParent: true },
  "Grandview Custom Homes": { type: "custom_builder", allowProjToParent: true },
  "Group Three Builders": { type: "custom_builder", allowProjToParent: true },
  "Heyl Homes": { type: "custom_builder", allowProjToParent: true },
  "Highland Homes": { type: "large_builder", allowProjToParent: false },
  "Homebound Technolgies": { type: "custom_builder", allowProjToParent: true },
  "Landsea Homes": { type: "large_builder", allowProjToParent: false },
  "Lennar Homes": { type: "large_builder", allowProjToParent: false },
  "LGI Homes": { type: "large_builder", allowProjToParent: false },
  "Lux Endeavors": { type: "custom_builder", allowProjToParent: true },
  "M/I Homes": { type: "large_builder", allowProjToParent: false },
  "Masonwood Development": { type: "large_builder", allowProjToParent: false },
  "MHI Homes": { type: "large_builder", allowProjToParent: false },
  "Milestone Community Builders": { type: "large_builder", allowProjToParent: false },
  "Millennium Pools": { type: "pool_company", allowProjToParent: true },
  "Modern Homestead": { type: "custom_builder", allowProjToParent: true },
  "New Home Co.": { type: "large_builder", allowProjToParent: false },
  "Nexstep Homes, LLC dba Thurman Homes": { type: "custom_builder", allowProjToParent: true },
  "Perry Homes": { type: "large_builder", allowProjToParent: false },
  "Pulte Homes": { type: "large_builder", allowProjToParent: false },
  "Rausch Coleman": { type: "custom_builder", allowProjToParent: true },
  "Ricara Constructions LLC": { type: "custom_builder", allowProjToParent: true },
  "Richmond American": { type: "large_builder", allowProjToParent: false },
  "Robins Construction": { type: "custom_builder", allowProjToParent: true },
  "Scott Felder Homes": { type: "large_builder", allowProjToParent: false },
  "Sendero Homes": { type: "custom_builder", allowProjToParent: true },
  "Silverado Signature Homes": { type: "custom_builder", allowProjToParent: true },
  "Silverton Custom Homes": { type: "custom_builder", allowProjToParent: true },
  "Southerly Homes": { type: "custom_builder", allowProjToParent: true },
  "Starlight Homes": { type: "large_builder", allowProjToParent: false },
  "Thurman Homes": { type: "custom_builder", allowProjToParent: true },
  "Tri Pointe Homes": { type: "large_builder", allowProjToParent: false },
  "Two Ten Communities": { type: "custom_builder", allowProjToParent: true },
  "Westin Homes": { type: "large_builder", allowProjToParent: false },
  "Williams Homes": { type: "custom_builder", allowProjToParent: true },
  "Zach Savage Homes": { type: "custom_builder", allowProjToParent: true },
  "Hillwood Communities": { type: "custom_builder", allowProjToParent: true }
};

interface QboCustomer {
  Id: string;
  DisplayName: string;
  CompanyName?: string;
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
  Active: boolean;
}

interface ValidationResult {
  spreadsheetName: string;
  qboMatch: {
    id: string;
    displayName: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
    subCustomerCount: number;
  } | null;
  metadata: { type: string; allowProjToParent: boolean };
  matchType: 'exact' | 'close' | 'not_found';
  possibleMatches?: string[];
}

/**
 * Query QBO for a specific customer by name
 */
async function queryCustomerByName(
  oauthClient: OAuthClient,
  baseUrl: string,
  realmId: string,
  customerName: string
): Promise<QboCustomer | null> {
  // Escape single quotes in name for LIKE query
  const escapedName = customerName.replace(/'/g, "\\'");
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`);

  try {
    const response = await oauthClient.makeApiCall({
      url: `${baseUrl}/v3/company/${realmId}/query?query=${query}`,
      method: 'GET',
    });

    const result = response.json;
    const customers: QboCustomer[] = result.QueryResponse?.Customer || [];

    // Return first match that is a parent customer (no ParentRef)
    return customers.find(c => !c.ParentRef) || null;
  } catch (error) {
    console.error(`Error querying customer "${customerName}":`, error);
    return null;
  }
}

/**
 * Count sub-customers for a parent customer
 */
async function countSubCustomers(
  oauthClient: OAuthClient,
  baseUrl: string,
  realmId: string,
  parentId: string
): Promise<number> {
  const query = encodeURIComponent(`SELECT COUNT(*) FROM Customer WHERE ParentRef = '${parentId}'`);

  try {
    const response = await oauthClient.makeApiCall({
      url: `${baseUrl}/v3/company/${realmId}/query?query=${query}`,
      method: 'GET',
    });

    const result = response.json;
    return result.QueryResponse?.totalCount || 0;
  } catch (error) {
    console.error(`Error counting sub-customers for ${parentId}:`, error);
    return 0;
  }
}

/**
 * Validate Builder names against QBO
 * GET /.netlify/functions/qbo-validate-builders
 *
 * Queries each builder name individually to handle large customer bases
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

    console.log(`Validating ${BUILDER_NAMES.length} builders against QBO...`);

    // Query each builder name individually - run in batches to avoid timeout
    const results: ValidationResult[] = [];
    const batchSize = 10;

    for (let i = 0; i < BUILDER_NAMES.length; i += batchSize) {
      const batch = BUILDER_NAMES.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(BUILDER_NAMES.length / batchSize)}`);

      // Process batch in parallel
      const batchPromises = batch.map(async (builderName) => {
        const metadata = BUILDER_METADATA[builderName] || { type: 'custom_builder', allowProjToParent: true };

        // Query QBO for this specific customer
        const customer = await queryCustomerByName(oauthClient, baseUrl, realmId, builderName);

        if (customer) {
          return {
            spreadsheetName: builderName,
            qboMatch: {
              id: customer.Id,
              displayName: customer.DisplayName,
              email: customer.PrimaryEmailAddr?.Address,
              phone: customer.PrimaryPhone?.FreeFormNumber,
              address: customer.BillAddr ? {
                line1: customer.BillAddr.Line1,
                city: customer.BillAddr.City,
                state: customer.BillAddr.CountrySubDivisionCode,
                zip: customer.BillAddr.PostalCode,
              } : undefined,
              subCustomerCount: 0, // Skip count for speed
            },
            metadata,
            matchType: 'exact' as const,
          };
        } else {
          return {
            spreadsheetName: builderName,
            qboMatch: null,
            metadata,
            matchType: 'not_found' as const,
            possibleMatches: [] as string[],
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Summary stats
    const exactMatches = results.filter(r => r.matchType === 'exact').length;
    const closeMatches = results.filter(r => r.matchType === 'close').length;
    const notFound = results.filter(r => r.matchType === 'not_found').length;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: {
          total: BUILDER_NAMES.length,
          exactMatches,
          closeMatches,
          notFound,
        },
        results,
      }, null, 2),
    };

  } catch (error) {
    console.error('QBO Validate Builders Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
