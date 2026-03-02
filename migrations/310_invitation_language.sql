-- Migration 310: Add preferred_language to user_invitations
-- and update accept_invitation to copy language preference on signup

-- 1. Add preferred_language to user_invitations
ALTER TABLE user_invitations
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en'
  CHECK (preferred_language IN ('en', 'es'));

-- 2. Update accept_invitation to copy preferred_language to user_profiles
CREATE OR REPLACE FUNCTION accept_invitation(
  p_email TEXT,
  p_token TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_invitation RECORD;
  v_app_role TEXT;
  v_legacy_role TEXT;
BEGIN
  -- Validate and get the invitation
  SELECT * INTO v_invitation
  FROM user_invitations
  WHERE email = p_email
    AND token = p_token
    AND is_used = false
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Mark as used
  UPDATE user_invitations
  SET is_used = true
  WHERE id = v_invitation.id;

  -- Map invitation role to AppRole
  v_app_role := CASE v_invitation.role
    WHEN 'admin' THEN 'admin'
    WHEN 'owner' THEN 'owner'
    WHEN 'sales-manager' THEN 'sales_manager'
    WHEN 'sales' THEN 'sales_rep'
    WHEN 'sales_rep' THEN 'sales_rep'
    WHEN 'sales_manager' THEN 'sales_manager'
    WHEN 'operations' THEN 'operations'
    WHEN 'ops_manager' THEN 'ops_manager'
    WHEN 'front_desk' THEN 'front_desk'
    WHEN 'yard' THEN 'yard'
    WHEN 'crew' THEN 'crew'
    ELSE 'sales_rep'
  END;

  -- Map to legacy role for user_profiles.role CHECK constraint
  v_legacy_role := CASE v_app_role
    WHEN 'owner' THEN 'admin'
    WHEN 'admin' THEN 'admin'
    WHEN 'sales_manager' THEN 'sales-manager'
    WHEN 'sales_rep' THEN 'sales'
    WHEN 'front_desk' THEN 'sales'
    WHEN 'ops_manager' THEN 'operations'
    WHEN 'operations' THEN 'operations'
    WHEN 'yard' THEN 'operations'
    WHEN 'crew' THEN 'operations'
    ELSE 'sales'
  END;

  -- Update user profile with legacy role, approval, AND language preference
  UPDATE user_profiles
  SET
    role = v_legacy_role,
    approval_status = 'approved',
    approved_at = NOW(),
    preferred_language = COALESCE(v_invitation.preferred_language, 'en')
  WHERE id = p_user_id;

  -- Create/update user_roles entry (source of truth)
  INSERT INTO user_roles (user_id, role_key, assigned_by)
  VALUES (p_user_id, v_app_role, v_invitation.invited_by)
  ON CONFLICT (user_id) DO UPDATE
  SET role_key = EXCLUDED.role_key,
      assigned_by = EXCLUDED.assigned_by,
      assigned_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION accept_invitation(TEXT, TEXT, UUID) TO authenticated;
