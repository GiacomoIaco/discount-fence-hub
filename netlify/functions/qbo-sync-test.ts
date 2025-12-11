import type { Handler } from '@netlify/functions';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Test Client -> Customer and Community -> Sub-Customer sync
 * GET /.netlify/functions/qbo-sync-test
 *
 * Creates a test client and community in QBO sandbox
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
        body: JSON.stringify({ error: 'Not connected to QuickBooks. Visit /qbo-auth first.' }),
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

    // Test data - simulating a Client Hub client
    const testClient = {
      name: 'Test Builder Inc',
      code: 'TEST-001',
      primary_contact_name: 'John Builder',
      primary_contact_email: 'john@testbuilder.com',
      primary_contact_phone: '555-123-4567',
      billing_email: 'billing@testbuilder.com',
      address_line1: '123 Construction Ave',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    };

    // Test community - simulating a Client Hub community
    const testCommunity = {
      name: 'Sunset Ridge Phase 1',
      code: 'SR-PH1',
      address_line1: '500 Sunset Ridge Dr',
      city: 'Austin',
      state: 'TX',
      zip: '78702',
    };

    const results: any = {
      steps: [],
      customer: null,
      subCustomer: null,
    };

    // Step 1: Create the Customer (Client)
    results.steps.push({ step: 1, action: 'Creating Customer from Client...' });

    const customerPayload = {
      DisplayName: `${testClient.name} (${testClient.code})`,
      CompanyName: testClient.name,
      GivenName: testClient.primary_contact_name?.split(' ')[0] || '',
      FamilyName: testClient.primary_contact_name?.split(' ').slice(1).join(' ') || '',
      PrimaryEmailAddr: testClient.billing_email ? { Address: testClient.billing_email } : undefined,
      PrimaryPhone: testClient.primary_contact_phone ? { FreeFormNumber: testClient.primary_contact_phone } : undefined,
      BillAddr: {
        Line1: testClient.address_line1,
        City: testClient.city,
        CountrySubDivisionCode: testClient.state,
        PostalCode: testClient.zip,
        Country: 'US',
      },
      Notes: `Synced from Client Hub. Code: ${testClient.code}`,
    };

    const customerResponse = await oauthClient.makeApiCall({
      url: `${baseUrl}/v3/company/${realmId}/customer`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerPayload),
    });

    const customerResult = customerResponse.json;
    const customerId = customerResult.Customer.Id;
    results.customer = {
      id: customerId,
      displayName: customerResult.Customer.DisplayName,
      syncToken: customerResult.Customer.SyncToken,
    };
    results.steps.push({ step: 1, status: 'success', customerId });

    // Step 2: Create the Sub-Customer (Community)
    results.steps.push({ step: 2, action: 'Creating Sub-Customer from Community...' });

    const subCustomerPayload = {
      DisplayName: `${testCommunity.name} (${testCommunity.code})`,
      CompanyName: testCommunity.name,
      ParentRef: {
        value: customerId, // Link to parent customer
      },
      Job: true, // Mark as a job/sub-customer
      BillAddr: {
        Line1: testCommunity.address_line1,
        City: testCommunity.city,
        CountrySubDivisionCode: testCommunity.state,
        PostalCode: testCommunity.zip,
        Country: 'US',
      },
      Notes: `Synced from Client Hub Community. Code: ${testCommunity.code}`,
    };

    const subCustomerResponse = await oauthClient.makeApiCall({
      url: `${baseUrl}/v3/company/${realmId}/customer`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subCustomerPayload),
    });

    const subCustomerResult = subCustomerResponse.json;
    const subCustomerId = subCustomerResult.Customer.Id;
    results.subCustomer = {
      id: subCustomerId,
      displayName: subCustomerResult.Customer.DisplayName,
      parentId: customerId,
      isJob: subCustomerResult.Customer.Job,
      syncToken: subCustomerResult.Customer.SyncToken,
    };
    results.steps.push({ step: 2, status: 'success', subCustomerId });

    // Return HTML results
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
            <h1>&#x2705; QBO Sync Test Successful!</h1>

            <h2>Step 1: Client &#x2192; Customer</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Client Hub</strong></td><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>QBO Customer</strong></td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;">Name: ${testClient.name}</td><td style="padding: 8px; border: 1px solid #ddd;">ID: ${customerId}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;">Code: ${testClient.code}</td><td style="padding: 8px; border: 1px solid #ddd;">DisplayName: ${results.customer.displayName}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;">Contact: ${testClient.primary_contact_name}</td><td style="padding: 8px; border: 1px solid #ddd;">SyncToken: ${results.customer.syncToken}</td></tr>
            </table>

            <h2>Step 2: Community &#x2192; Sub-Customer</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Client Hub</strong></td><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>QBO Sub-Customer</strong></td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;">Name: ${testCommunity.name}</td><td style="padding: 8px; border: 1px solid #ddd;">ID: ${subCustomerId}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;">Code: ${testCommunity.code}</td><td style="padding: 8px; border: 1px solid #ddd;">DisplayName: ${results.subCustomer.displayName}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;">Parent Client: ${testClient.name}</td><td style="padding: 8px; border: 1px solid #ddd;">ParentRef: ${customerId}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;"></td><td style="padding: 8px; border: 1px solid #ddd;">Job: ${results.subCustomer.isJob ? 'Yes' : 'No'}</td></tr>
            </table>

            <h2>Hierarchy in QBO</h2>
            <div style="padding: 20px; background: #f0f9ff; border-radius: 8px; font-family: monospace;">
              <div style="margin-left: 0;">&#x1F4C1; ${results.customer.displayName}</div>
              <div style="margin-left: 30px;">&#x2514;&#x2500; &#x1F4C2; ${results.subCustomer.displayName}</div>
            </div>

            <h2>What This Means</h2>
            <ul>
              <li><strong>Client</strong> "${testClient.name}" is now a <strong>Customer</strong> in QBO</li>
              <li><strong>Community</strong> "${testCommunity.name}" is a <strong>Sub-Customer</strong> under that Customer</li>
              <li>You can now attach invoices, sales receipts, etc. to either level</li>
              <li>Financial reports can roll up from Community &#x2192; Client</li>
            </ul>

            <h2>Next Steps</h2>
            <ol>
              <li>Check your QBO Sandbox to see these entries</li>
              <li>When ready: hook this into Client Hub's create/update flows</li>
              <li>Store the QBO IDs back in Client Hub (quickbooks_id field exists!)</li>
            </ol>

            <br/>
            <a href="/.netlify/functions/qbo-test" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">
              Back to Connection Test
            </a>
            <a href="/" style="padding: 10px 20px; background: #6b7280; color: white; text-decoration: none; border-radius: 5px;">
              Return to App
            </a>
          </body>
        </html>
      `,
    };
  } catch (error) {
    console.error('QBO Sync Test Error:', error);

    // Try to extract QBO error details
    let errorDetails = error instanceof Error ? error.message : 'Unknown error';
    if ((error as any).response?.json) {
      errorDetails = JSON.stringify((error as any).response.json, null, 2);
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>&#x274C; Sync Test Failed</h1>
            <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
            <pre style="text-align: left; background: #f5f5f5; padding: 20px; overflow: auto; max-width: 800px; margin: 20px auto;">${errorDetails}</pre>
            <br/>
            <a href="/.netlify/functions/qbo-auth" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
              Reconnect to QuickBooks
            </a>
          </body>
        </html>
      `,
    };
  }
};
