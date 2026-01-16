import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

type JobberAccount = 'residential' | 'builders' | 'commercial';

const ACCOUNT_NAMES: Record<JobberAccount, string> = {
  residential: 'Discount Fence - Residential',
  builders: 'Discount Fence - Builders',
  commercial: 'Discount Fence - Commercial',
};

const ACCOUNT_COLORS: Record<JobberAccount, string> = {
  residential: '#2563eb',
  builders: '#16a34a',
  commercial: '#9333ea',
};

/**
 * Refresh Jobber access token
 */
async function refreshToken(account: string, refreshTokenValue: string): Promise<string> {
  console.log(`Refreshing token for ${account}...`);

  const response = await fetch(JOBBER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
      client_id: process.env.JOBBER_CLIENT_ID!,
      client_secret: process.env.JOBBER_CLIENT_SECRET!,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const token = await response.json();

  // Update stored tokens
  const now = new Date();
  const expiresIn = token.expires_in || 3600;
  const accessTokenExpiresAt = new Date(now.getTime() + expiresIn * 1000);

  await supabase
    .from('jobber_tokens')
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token || refreshTokenValue, // Keep old if not returned
      access_token_expires_at: accessTokenExpiresAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', account);

  console.log('Token refreshed successfully');
  return token.access_token;
}

/**
 * Test Jobber API connection
 * GET /.netlify/functions/jobber-test?account=residential
 *
 * Fetches account info and data counts to verify the connection works
 */
export const handler: Handler = async (event) => {
  try {
    const account = (event.queryStringParameters?.account || 'residential') as JobberAccount;

    // Get stored tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('jobber_tokens')
      .select('*')
      .eq('id', account)
      .single();

    if (tokenError || !tokenData) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h1 style="color: #f59e0b;">&#9888; Not Connected</h1>
              <p>No Jobber connection found for <strong>${account}</strong>.</p>
              <br/>
              <a href="/.netlify/functions/jobber-auth?account=${account}" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                Connect ${ACCOUNT_NAMES[account] || account}
              </a>
            </body>
          </html>
        `,
      };
    }

    // Check if access token is expired and refresh if needed
    const isExpired = new Date(tokenData.access_token_expires_at) < new Date();
    let accessToken = tokenData.access_token;

    if (isExpired) {
      console.log('Access token expired, refreshing...');
      try {
        accessToken = await refreshToken(account, tokenData.refresh_token);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'text/html' },
          body: `
            <html>
              <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">&#10008; Token Expired</h1>
                <p>Failed to refresh access token. Please reconnect.</p>
                <p style="color: #6b7280;">${refreshError instanceof Error ? refreshError.message : ''}</p>
                <br/>
                <a href="/.netlify/functions/jobber-auth?account=${account}" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                  Reconnect ${ACCOUNT_NAMES[account] || account}
                </a>
              </body>
            </html>
          `,
        };
      }
    }

    // Make GraphQL query to get account info and data counts
    const query = `
      query TestConnection {
        account {
          id
          name
        }
        users(first: 10) {
          nodes {
            id
            name {
              full
            }
            email {
              raw
            }
          }
          totalCount
        }
        clients(first: 1) {
          totalCount
        }
        jobs(first: 1) {
          totalCount
        }
        quotes(first: 1) {
          totalCount
        }
        invoices(first: 1) {
          totalCount
        }
      }
    `;

    const response = await fetch(JOBBER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION || '2025-01-20',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
    }

    const { account: accountInfo, users, clients, jobs, quotes, invoices } = result.data;
    const accountColor = ACCOUNT_COLORS[account] || '#2563eb';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
            <h1 style="color: #16a34a;">&#10004; Jobber API Working!</h1>

            <p style="font-size: 1.2em;">
              <span style="display: inline-block; padding: 5px 15px; background: ${accountColor}; color: white; border-radius: 20px;">
                ${ACCOUNT_NAMES[account] || account}
              </span>
            </p>

            <h2>Account Info</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Account Name</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${accountInfo?.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Jobber Account ID</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${accountInfo?.id || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>DFU Account Type</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${account}</td>
              </tr>
            </table>

            <h2>Data Counts</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Clients</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${clients?.totalCount?.toLocaleString() || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Jobs</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${jobs?.totalCount?.toLocaleString() || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Quotes</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${quotes?.totalCount?.toLocaleString() || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Invoices</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${invoices?.totalCount?.toLocaleString() || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Team Members</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${users?.totalCount || 0}</td>
              </tr>
            </table>

            <h2>Team Members (First 10)</h2>
            <ul style="text-align: left;">
              ${users?.nodes?.map((u: { name?: { full?: string }, email?: { raw?: string } }) =>
                `<li>${u.name?.full || 'Unknown'} <span style="color: #6b7280;">(${u.email?.raw || 'no email'})</span></li>`
              ).join('') || '<li>No users found</li>'}
            </ul>

            <h2>Token Status</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Access Token Expires</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(tokenData.access_token_expires_at).toLocaleString()}</td>
              </tr>
              ${tokenData.refresh_token_expires_at ? `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Refresh Token Expires</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(tokenData.refresh_token_expires_at).toLocaleDateString()}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Last Updated</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(tokenData.updated_at).toLocaleString()}</td>
              </tr>
            </table>

            <br/>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
              <a href="/.netlify/functions/jobber-status" style="padding: 10px 20px; background: #6b7280; color: white; text-decoration: none; border-radius: 5px;">
                View All Connections
              </a>
              <a href="/" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                Return to App
              </a>
            </div>
          </body>
        </html>
      `,
    };
  } catch (error) {
    console.error('Jobber Test Error:', error);
    const account = event.queryStringParameters?.account || 'residential';

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #dc2626;">&#10008; API Test Failed</h1>
            <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
            <pre style="text-align: left; background: #f5f5f5; padding: 20px; overflow: auto; max-width: 100%; margin: 20px auto;">
${error instanceof Error ? error.stack : ''}
            </pre>
            <br/>
            <a href="/.netlify/functions/jobber-auth?account=${account}" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
              Reconnect to Jobber
            </a>
          </body>
        </html>
      `,
    };
  }
};
