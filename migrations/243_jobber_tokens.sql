-- Jobber OAuth Token Storage
-- Supports multiple Jobber accounts (Residential, Builders, Commercial)
-- Following same pattern as qbo_tokens (migration 138)

-- Token storage table
CREATE TABLE IF NOT EXISTS jobber_tokens (
  id TEXT PRIMARY KEY, -- 'residential', 'builders', 'commercial'
  account_name TEXT NOT NULL, -- Human-readable name
  account_id TEXT, -- Jobber account ID (from API response)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ, -- May be null if no expiration
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT, -- Granted scopes (comma-separated)
  connected_by TEXT, -- User who connected (email or user_id)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_jobber_tokens_account ON jobber_tokens(account_id);

-- RLS Policies (service role only - tokens are sensitive)
ALTER TABLE jobber_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access tokens (not anon or authenticated users)
CREATE POLICY "Service role only" ON jobber_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Sync status tracking table
CREATE TABLE IF NOT EXISTS jobber_sync_status (
  id TEXT PRIMARY KEY, -- 'residential', 'builders', 'commercial'
  last_sync_at TIMESTAMPTZ,
  last_sync_type TEXT, -- 'full', 'incremental'
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'failed', 'in_progress')),
  last_error TEXT,
  jobs_synced INTEGER DEFAULT 0,
  quotes_synced INTEGER DEFAULT 0,
  invoices_synced INTEGER DEFAULT 0,
  clients_synced INTEGER DEFAULT 0,
  timesheets_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for sync status (can be read by authenticated users)
ALTER TABLE jobber_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read" ON jobber_sync_status
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role write" ON jobber_sync_status
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Comments for documentation
COMMENT ON TABLE jobber_tokens IS 'Stores OAuth tokens for Jobber API integration (multiple accounts: residential, builders, commercial)';
COMMENT ON COLUMN jobber_tokens.id IS 'Account identifier: residential, builders, or commercial';
COMMENT ON COLUMN jobber_tokens.account_id IS 'Jobber internal account ID returned from API';
COMMENT ON COLUMN jobber_tokens.refresh_token_expires_at IS 'Refresh tokens may expire due to: app disconnection, secret rotation, scope changes, or token rotation';

COMMENT ON TABLE jobber_sync_status IS 'Tracks sync status and statistics for each Jobber account';
