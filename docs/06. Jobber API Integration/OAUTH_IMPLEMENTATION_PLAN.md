# Jobber OAuth Implementation Plan

> **Created**: 2026-01-15
> **Status**: Ready to Implement
> **Reference**: Following QBO OAuth pattern in `netlify/functions/qbo-*.ts`

## Overview

Implement OAuth 2.0 flow for connecting multiple Jobber accounts (Residential, Builders, Commercial) to DFU.

---

## 1. Database Schema

### Migration: `240_jobber_tokens.sql`

```sql
-- Jobber OAuth Token Storage
-- Supports multiple Jobber accounts (Residential, Builders, Commercial)

CREATE TABLE IF NOT EXISTS jobber_tokens (
  id TEXT PRIMARY KEY, -- 'residential', 'builders', 'commercial'
  account_name TEXT NOT NULL, -- Human-readable name
  account_id TEXT, -- Jobber account ID (from API response)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ, -- May be null if refresh doesn't expire
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT, -- Granted scopes
  connected_by TEXT, -- User who connected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_jobber_tokens_account ON jobber_tokens(account_id);

-- RLS Policies (service role only - tokens are sensitive)
ALTER TABLE jobber_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access tokens
CREATE POLICY "Service role only" ON jobber_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Sync status tracking
CREATE TABLE IF NOT EXISTS jobber_sync_status (
  id TEXT PRIMARY KEY, -- 'residential', 'builders', 'commercial'
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'failed', 'in_progress')),
  last_error TEXT,
  jobs_synced INTEGER DEFAULT 0,
  quotes_synced INTEGER DEFAULT 0,
  invoices_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE jobber_tokens IS 'Stores OAuth tokens for Jobber API integration (multiple accounts)';
COMMENT ON TABLE jobber_sync_status IS 'Tracks sync status for each Jobber account';
```

---

## 2. Environment Variables

Add to `.env` and Netlify:

```bash
# Jobber OAuth (single app, multiple accounts)
JOBBER_CLIENT_ID=your_client_id
JOBBER_CLIENT_SECRET=your_client_secret
JOBBER_REDIRECT_URI=https://discount-fence-hub.netlify.app/.netlify/functions/jobber-callback

# Jobber API
JOBBER_API_URL=https://api.getjobber.com/api/graphql
JOBBER_API_VERSION=2025-01-20
```

---

## 3. Netlify Functions

### 3.1 `jobber-auth.ts` - Initiate OAuth Flow

```typescript
import type { Handler } from '@netlify/functions';

const JOBBER_AUTH_URL = 'https://api.getjobber.com/api/oauth/authorize';

/**
 * Initiates Jobber OAuth flow
 * GET /.netlify/functions/jobber-auth?account=residential
 *
 * Query params:
 *   - account: 'residential' | 'builders' | 'commercial'
 */
export const handler: Handler = async (event) => {
  try {
    const account = event.queryStringParameters?.account || 'residential';

    // Validate account type
    if (!['residential', 'builders', 'commercial'].includes(account)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid account type. Use: residential, builders, commercial' }),
      };
    }

    // Generate state with account identifier for callback
    const state = `jobber_${account}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: process.env.JOBBER_CLIENT_ID!,
      redirect_uri: process.env.JOBBER_REDIRECT_URI!,
      response_type: 'code',
      state: state,
      // Jobber scopes - request what we need
      // Common scopes: read_clients, write_clients, read_jobs, write_jobs, etc.
    });

    const authUrl = `${JOBBER_AUTH_URL}?${params.toString()}`;

    console.log(`Redirecting to Jobber auth for account: ${account}`);

    return {
      statusCode: 302,
      headers: {
        Location: authUrl,
        'Cache-Control': 'no-cache',
      },
      body: '',
    };
  } catch (error) {
    console.error('Jobber Auth Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to initiate OAuth flow',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
```

### 3.2 `jobber-callback.ts` - Handle OAuth Callback

```typescript
import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Handles OAuth callback from Jobber
 * GET /.netlify/functions/jobber-callback?code=...&state=...
 */
export const handler: Handler = async (event) => {
  try {
    const { code, state, error, error_description } = event.queryStringParameters || {};

    // Check for error response
    if (error) {
      console.error('Jobber Auth Error:', error, error_description);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h1>❌ Jobber Connection Failed</h1>
              <p>Error: ${error}</p>
              <p>${error_description || ''}</p>
              <a href="/settings">Return to Settings</a>
            </body>
          </html>
        `,
      };
    }

    // Parse account from state (format: jobber_ACCOUNT_timestamp_random)
    const stateParts = state?.split('_') || [];
    const account = stateParts[1] || 'residential';

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(JOBBER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code!,
        client_id: process.env.JOBBER_CLIENT_ID!,
        client_secret: process.env.JOBBER_CLIENT_SECRET!,
        redirect_uri: process.env.JOBBER_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorBody}`);
    }

    const token = await tokenResponse.json();

    console.log('Token received for account:', account);
    console.log('Token keys:', Object.keys(token));

    // Calculate expiration (Jobber typically uses expires_in in seconds)
    const now = new Date();
    const accessTokenExpiresAt = new Date(now.getTime() + (token.expires_in || 3600) * 1000);

    // Refresh token expiration (if provided, otherwise null)
    const refreshTokenExpiresAt = token.refresh_token_expires_in
      ? new Date(now.getTime() + token.refresh_token_expires_in * 1000)
      : null;

    // Get account name mapping
    const accountNames: Record<string, string> = {
      residential: 'Discount Fence - Residential',
      builders: 'Discount Fence - Builders',
      commercial: 'Discount Fence - Commercial',
    };

    // Store tokens in Supabase
    const { error: upsertError } = await supabase
      .from('jobber_tokens')
      .upsert({
        id: account,
        account_name: accountNames[account] || account,
        account_id: token.account_id || null,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        access_token_expires_at: accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt?.toISOString() || null,
        token_type: token.token_type || 'Bearer',
        scope: token.scope || null,
        updated_at: now.toISOString(),
      }, {
        onConflict: 'id',
      });

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError);
      throw new Error(`Failed to store tokens: ${upsertError.message}`);
    }

    console.log(`Tokens stored successfully for ${account}`);

    // Success page
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>✅ Jobber Connected!</h1>
            <p>Your <strong>${accountNames[account]}</strong> account has been successfully connected.</p>
            <p><strong>Access Token Expires:</strong> ${accessTokenExpiresAt.toLocaleString()}</p>
            ${refreshTokenExpiresAt ? `<p><strong>Refresh Token Expires:</strong> ${refreshTokenExpiresAt.toLocaleDateString()}</p>` : ''}
            <br/>
            <a href="/settings" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
              Return to Settings
            </a>
            <br/><br/>
            <a href="/.netlify/functions/jobber-test?account=${account}" style="padding: 10px 20px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px;">
              Test API Connection
            </a>
          </body>
        </html>
      `,
    };
  } catch (error) {
    console.error('Jobber Callback Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>❌ Connection Error</h1>
            <p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>
            <a href="/settings">Return to Settings</a>
          </body>
        </html>
      `,
    };
  }
};
```

### 3.3 `jobber-test.ts` - Test API Connection

```typescript
import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Test Jobber API connection
 * GET /.netlify/functions/jobber-test?account=residential
 */
export const handler: Handler = async (event) => {
  try {
    const account = event.queryStringParameters?.account || 'residential';

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
              <h1>⚠️ Not Connected</h1>
              <p>No Jobber connection found for <strong>${account}</strong>. Please connect first.</p>
              <a href="/.netlify/functions/jobber-auth?account=${account}" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                Connect ${account}
              </a>
            </body>
          </html>
        `,
      };
    }

    // Check if access token is expired
    const isExpired = new Date(tokenData.access_token_expires_at) < new Date();
    let accessToken = tokenData.access_token;

    if (isExpired) {
      console.log('Access token expired, refreshing...');
      accessToken = await refreshJobberToken(account, tokenData.refresh_token);
    }

    // Make GraphQL query to get account info
    const query = `
      query {
        account {
          id
          name
        }
        users(first: 5) {
          nodes {
            id
            name {
              full
            }
            email {
              raw
            }
          }
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
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const { account: accountInfo, users, clients, jobs, quotes } = result.data;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
            <h1>✅ Jobber API Working!</h1>

            <h2>Account Info</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Account Name</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${accountInfo?.name || tokenData.account_name}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Account ID</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${accountInfo?.id || 'N/A'}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>DFU Account Type</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${account}</td></tr>
            </table>

            <h2>Data Counts</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Clients</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${clients?.totalCount || 0}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Jobs</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${jobs?.totalCount || 0}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Quotes</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${quotes?.totalCount || 0}</td></tr>
            </table>

            <h2>Team Members (First 5)</h2>
            <ul>
              ${users?.nodes?.map((u: any) => `<li>${u.name?.full || 'Unknown'} (${u.email?.raw || 'no email'})</li>`).join('') || '<li>No users found</li>'}
            </ul>

            <h2>Token Status</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Access Token Expires</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(tokenData.access_token_expires_at).toLocaleString()}</td></tr>
              ${tokenData.refresh_token_expires_at ? `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Refresh Token Expires</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(tokenData.refresh_token_expires_at).toLocaleDateString()}</td></tr>` : ''}
            </table>

            <br/>
            <a href="/settings" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
              Return to Settings
            </a>
          </body>
        </html>
      `,
    };
  } catch (error) {
    console.error('Jobber Test Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>❌ API Test Failed</h1>
            <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
            <pre style="text-align: left; background: #f5f5f5; padding: 20px; overflow: auto; max-width: 100%;">${error instanceof Error ? error.stack : ''}</pre>
            <br/>
            <a href="/.netlify/functions/jobber-auth?account=${event.queryStringParameters?.account || 'residential'}" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
              Reconnect to Jobber
            </a>
          </body>
        </html>
      `,
    };
  }
};

// Helper function to refresh token
async function refreshJobberToken(account: string, refreshToken: string): Promise<string> {
  const response = await fetch('https://api.getjobber.com/api/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.JOBBER_CLIENT_ID!,
      client_secret: process.env.JOBBER_CLIENT_SECRET!,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const token = await response.json();

  // Update stored tokens
  const now = new Date();
  const accessTokenExpiresAt = new Date(now.getTime() + (token.expires_in || 3600) * 1000);

  await supabase
    .from('jobber_tokens')
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token || refreshToken, // Keep old if not returned
      access_token_expires_at: accessTokenExpiresAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', account);

  console.log('Tokens refreshed successfully');
  return token.access_token;
}
```

### 3.4 `jobber-status.ts` - Check All Account Status

```typescript
import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Get status of all Jobber connections
 * GET /.netlify/functions/jobber-status
 */
export const handler: Handler = async () => {
  try {
    const { data: tokens, error } = await supabase
      .from('jobber_tokens')
      .select('id, account_name, account_id, access_token_expires_at, refresh_token_expires_at, updated_at')
      .order('id');

    if (error) {
      throw error;
    }

    const accounts = ['residential', 'builders', 'commercial'];
    const status = accounts.map(acc => {
      const token = tokens?.find(t => t.id === acc);
      if (!token) {
        return { id: acc, connected: false };
      }

      const accessExpired = new Date(token.access_token_expires_at) < new Date();
      const refreshExpired = token.refresh_token_expires_at
        ? new Date(token.refresh_token_expires_at) < new Date()
        : false;

      return {
        id: acc,
        connected: true,
        account_name: token.account_name,
        account_id: token.account_id,
        access_expired: accessExpired,
        refresh_expired: refreshExpired,
        access_token_expires_at: token.access_token_expires_at,
        refresh_token_expires_at: token.refresh_token_expires_at,
        last_updated: token.updated_at,
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts: status }),
    };
  } catch (error) {
    console.error('Jobber Status Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
    };
  }
};
```

---

## 4. Shared Utility: `lib/jobber.ts`

```typescript
// src/lib/jobber.ts

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_API_VERSION = '2025-01-20';

export type JobberAccount = 'residential' | 'builders' | 'commercial';

/**
 * Make a GraphQL request to Jobber API
 * This is for client-side use - calls go through our Netlify functions
 */
export async function jobberQuery<T = any>(
  account: JobberAccount,
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await fetch('/.netlify/functions/jobber-graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ account, query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Jobber API error: ${response.status}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

/**
 * Get connection status for all accounts
 */
export async function getJobberStatus(): Promise<{
  accounts: Array<{
    id: JobberAccount;
    connected: boolean;
    account_name?: string;
    access_expired?: boolean;
  }>;
}> {
  const response = await fetch('/.netlify/functions/jobber-status');
  return response.json();
}
```

---

## 5. Implementation Steps

### Step 1: Database Migration
1. Create `migrations/240_jobber_tokens.sql`
2. Run: `npm run migrate:direct 240_jobber_tokens.sql`

### Step 2: Environment Variables
1. Add to local `.env`:
   ```
   JOBBER_CLIENT_ID=your_client_id
   JOBBER_CLIENT_SECRET=your_client_secret
   JOBBER_REDIRECT_URI=http://localhost:8888/.netlify/functions/jobber-callback
   ```
2. Add to Netlify environment variables (production URI)

### Step 3: Create Netlify Functions
1. `netlify/functions/jobber-auth.ts`
2. `netlify/functions/jobber-callback.ts`
3. `netlify/functions/jobber-test.ts`
4. `netlify/functions/jobber-status.ts`

### Step 4: Test Locally
```bash
netlify dev
# Visit: http://localhost:8888/.netlify/functions/jobber-auth?account=residential
```

### Step 5: Configure Jobber Developer Center
1. Log into [Jobber Developer Center](https://developer.getjobber.com)
2. Set redirect URI to production URL
3. Note any required scopes

### Step 6: Deploy & Test
```bash
git add .
git commit -m "feat: Jobber OAuth integration"
git push origin main
```

---

## 6. Jobber Developer Portal Setup

### Required Configuration

1. **App Name**: Discount Fence Hub
2. **Redirect URI**: `https://discount-fence-hub.netlify.app/.netlify/functions/jobber-callback`
3. **Webhook URL** (later): `https://discount-fence-hub.netlify.app/.netlify/functions/jobber-webhook`

### Scopes to Request

Based on API docs, likely scopes:
- `read_account` - Account info
- `read_clients` / `write_clients` - Client management
- `read_properties` / `write_properties` - Property management
- `read_quotes` / `write_quotes` - Quote management
- `read_jobs` / `write_jobs` - Job management
- `read_invoices` / `write_invoices` - Invoice management
- `read_timesheets` - Timesheet data
- `read_users` - Team member info

---

## 7. Future Enhancements

### Phase 2: GraphQL Proxy Function
Create `jobber-graphql.ts` that:
- Accepts GraphQL queries from frontend
- Handles token refresh automatically
- Routes to correct account

### Phase 3: Webhook Handler
Create `jobber-webhook.ts` that:
- Verifies HMAC signature
- Routes events by type (CLIENT_CREATE, JOB_COMPLETE, etc.)
- Updates DFU database

### Phase 4: Sync Functions
- `jobber-sync-jobs.ts` - Nightly job sync
- `jobber-sync-clients.ts` - Client sync
- `jobber-sync-timesheets.ts` - Timesheet pull for labor costing
