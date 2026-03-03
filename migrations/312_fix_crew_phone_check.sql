-- Migration 312: Fix phone normalization in check_crew_phone_authorized
-- Bug: Input "+15125551234" strips to "15125551234" (11 digits) but stored
-- "(512) 555-1234" strips to "5125551234" (10 digits). 11 != 10 => mismatch.
-- Fix: Use right(..., 10) on both sides (same pattern as auto_link_crew_on_signup in 309).
--
-- Also: Update auto_link_crew_on_signup to mark invitation as is_used = true
-- when a crew member signs up (currently links crew but leaves invitation pending forever).

-- ============================================================================
-- 1. Fix check_crew_phone_authorized to normalize to last 10 digits
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_crew_phone_authorized(p_phone TEXT)
  RETURNS BOOLEAN
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_digits TEXT;
  v_found BOOLEAN;
BEGIN
  -- Normalize to last 10 digits (strips country code)
  v_digits := right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 10);

  -- Need at least 10 digits
  IF length(v_digits) < 10 THEN
    RETURN FALSE;
  END IF;

  -- Check user_profiles (returning crew member)
  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE right(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = v_digits
  ) INTO v_found;

  IF v_found THEN RETURN TRUE; END IF;

  -- Check user_invitations (invited but hasn't signed up yet)
  SELECT EXISTS(
    SELECT 1 FROM user_invitations
    WHERE right(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = v_digits
      AND is_used = FALSE
      AND expires_at > NOW()
  ) INTO v_found;

  RETURN v_found;
END;
$$;

-- ============================================================================
-- 2. Update auto_link_crew_on_signup to also mark invitation as used
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_link_crew_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_digits text;
  v_crew_id uuid;
  v_invitation_id uuid;
BEGIN
  -- Only proceed if new user has a phone
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;

  -- Normalize to last 10 digits
  v_phone_digits := right(regexp_replace(NEW.phone, '\D', '', 'g'), 10);

  -- Find matching crew where lead_phone matches and no lead_user_id yet
  SELECT id INTO v_crew_id
  FROM crews
  WHERE lead_user_id IS NULL
    AND lead_phone IS NOT NULL
    AND right(regexp_replace(lead_phone, '\D', '', 'g'), 10) = v_phone_digits
  LIMIT 1;

  -- Link crew to new user
  IF v_crew_id IS NOT NULL THEN
    UPDATE crews
    SET lead_user_id = NEW.id,
        updated_at = now()
    WHERE id = v_crew_id;
  END IF;

  -- Mark matching invitation as used
  SELECT id INTO v_invitation_id
  FROM user_invitations
  WHERE role = 'crew'
    AND is_used = FALSE
    AND phone IS NOT NULL
    AND right(regexp_replace(phone, '\D', '', 'g'), 10) = v_phone_digits
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invitation_id IS NOT NULL THEN
    UPDATE user_invitations
    SET is_used = TRUE,
        used_at = now()
    WHERE id = v_invitation_id;
  END IF;

  RETURN NEW;
END;
$$;
