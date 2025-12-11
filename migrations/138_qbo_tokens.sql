-- QBO/IES OAuth Token Storage
-- Stores OAuth tokens for QuickBooks Online / Intuit Enterprise Suite API

CREATE TABLE IF NOT EXISTS qbo_tokens (
  id TEXT PRIMARY KEY DEFAULT 'primary', -- 'primary' for single company, or company identifier for multi
  realm_id TEXT NOT NULL, -- QBO Company ID
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL, -- ~100 days from issue
  token_type TEXT DEFAULT 'Bearer',
  environment TEXT DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_qbo_tokens_realm ON qbo_tokens(realm_id);

-- RLS Policies (service role only - tokens are sensitive)
ALTER TABLE qbo_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access tokens (not anon or authenticated users)
CREATE POLICY "Service role only" ON qbo_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Comment for documentation
COMMENT ON TABLE qbo_tokens IS 'Stores OAuth tokens for QuickBooks Online / Intuit Enterprise Suite API integration';
COMMENT ON COLUMN qbo_tokens.realm_id IS 'QBO Company ID - identifies which QuickBooks company this token is for';
COMMENT ON COLUMN qbo_tokens.refresh_token_expires_at IS 'Refresh tokens expire after ~100 days - need to re-authorize before this date';
