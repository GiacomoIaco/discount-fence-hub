-- Migration 219: Fix invitation approval status
-- Update accept_invitation function to properly set approval_status for invited users

CREATE OR REPLACE FUNCTION accept_invitation(
  p_email TEXT,
  p_token TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_invitation RECORD;
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

  -- Update user profile with invited role AND set as approved
  -- Invited users bypass the approval workflow since they were pre-approved
  UPDATE user_profiles
  SET
    role = v_invitation.role,
    approval_status = 'approved',
    approved_at = NOW()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION accept_invitation(TEXT, TEXT, UUID) TO authenticated;
