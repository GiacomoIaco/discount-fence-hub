-- Migration 309: Crew invite link
-- Adds invitation_id to crews table and auto-links crew on signup

-- 1. Add invitation_id column to crews
ALTER TABLE crews
  ADD COLUMN IF NOT EXISTS invitation_id uuid REFERENCES user_invitations(id) ON DELETE SET NULL;

-- 2. Trigger: auto-link crew record when a new user signs up
--    Matches by last 10 digits of phone number
CREATE OR REPLACE FUNCTION auto_link_crew_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_digits text;
  v_crew_id uuid;
BEGIN
  -- Only proceed if new user has a phone
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;

  -- Normalize to last 10 digits
  v_phone_digits := regexp_replace(NEW.phone, '\D', '', 'g');
  v_phone_digits := right(v_phone_digits, 10);

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

  RETURN NEW;
END;
$$;

-- Drop if exists, then create
DROP TRIGGER IF EXISTS trg_auto_link_crew_on_signup ON user_profiles;
CREATE TRIGGER trg_auto_link_crew_on_signup
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_crew_on_signup();
