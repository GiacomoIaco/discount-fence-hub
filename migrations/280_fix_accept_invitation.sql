-- Migration 280: Fix accept_invitation to create user_roles entry
-- The old version only updated user_profiles.role (legacy), missing the new user_roles table

CREATE OR REPLACE FUNCTION accept_invitation(
  p_email TEXT,
  p_token TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_invitation RECORD;
  v_app_role TEXT;
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
    WHEN 'sales-manager' THEN 'sales_manager'
    WHEN 'sales' THEN 'sales_rep'
    WHEN 'sales_rep' THEN 'sales_rep'
    WHEN 'sales_manager' THEN 'sales_manager'
    WHEN 'operations' THEN 'operations'
    WHEN 'ops_manager' THEN 'ops_manager'
    WHEN 'front_desk' THEN 'front_desk'
    WHEN 'yard' THEN 'yard'
    WHEN 'crew' THEN 'crew'
    WHEN 'owner' THEN 'owner'
    ELSE 'sales_rep'
  END;

  -- Update user profile with invited role AND set as approved
  UPDATE user_profiles
  SET
    role = v_invitation.role,
    approval_status = 'approved',
    approved_at = NOW()
  WHERE id = p_user_id;

  -- Create user_roles entry (trigger syncs back to user_profiles.role)
  INSERT INTO user_roles (user_id, role_key, assigned_by)
  VALUES (p_user_id, v_app_role, v_invitation.invited_by)
  ON CONFLICT (user_id) DO UPDATE
  SET role_key = EXCLUDED.role_key,
      assigned_by = EXCLUDED.assigned_by,
      assigned_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION accept_invitation(TEXT, TEXT, UUID) TO authenticated;
