-- Migration 306: Add phone column to user_invitations for crew SMS invites
-- Crew members are invited by phone (not email), receive an SMS with app link,
-- and can only log in via Phone OTP if their phone is in user_invitations or user_profiles.

-- ============================================================================
-- 1. Add phone column to user_invitations (nullable, only crew uses it)
-- ============================================================================
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================================
-- 2. Make email nullable (crew invites have phone but no email)
-- ============================================================================
ALTER TABLE user_invitations ALTER COLUMN email DROP NOT NULL;

-- ============================================================================
-- 3. RPC to check if a phone number is authorized for crew login
--    Returns true if phone exists in user_profiles OR in an active invitation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_crew_phone_authorized(p_phone TEXT)
  RETURNS BOOLEAN
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
  v_found BOOLEAN;
BEGIN
  -- Normalize: strip everything except digits
  v_normalized := regexp_replace(p_phone, '[^0-9]', '', 'g');

  -- Check user_profiles (returning crew member)
  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_normalized
  ) INTO v_found;

  IF v_found THEN RETURN TRUE; END IF;

  -- Check user_invitations (invited but hasn't signed up yet)
  SELECT EXISTS(
    SELECT 1 FROM user_invitations
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_normalized
      AND is_used = FALSE
      AND expires_at > NOW()
  ) INTO v_found;

  RETURN v_found;
END;
$$;

-- Grant execute to anon (called before auth) and authenticated
GRANT EXECUTE ON FUNCTION public.check_crew_phone_authorized(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_crew_phone_authorized(TEXT) TO authenticated;
