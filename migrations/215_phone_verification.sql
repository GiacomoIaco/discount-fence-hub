-- Migration 215: Phone Verification via OTP
-- Adds phone verification tracking and OTP storage

-- 1. Add phone_verified_at to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- 2. Create table for OTP codes (with expiry)
CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INT DEFAULT 0,
  CONSTRAINT max_attempts CHECK (attempts <= 5)
);

-- Index for looking up codes
CREATE INDEX IF NOT EXISTS idx_phone_verification_user
  ON phone_verification_codes(user_id, phone)
  WHERE verified_at IS NULL;

-- Index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_phone_verification_expires
  ON phone_verification_codes(expires_at)
  WHERE verified_at IS NULL;

-- 3. RLS policies
ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own verification codes
CREATE POLICY "Users can view own verification codes" ON phone_verification_codes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only service role can insert/update (via Netlify functions)
-- No INSERT/UPDATE policies for authenticated users

-- 4. Function to clean up expired codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM phone_verification_codes
  WHERE expires_at < NOW() AND verified_at IS NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to verify phone (called after OTP verified)
CREATE OR REPLACE FUNCTION verify_user_phone(p_user_id UUID, p_phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_profiles
  SET
    phone = p_phone,
    phone_verified_at = NOW()
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
