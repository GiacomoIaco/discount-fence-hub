-- Migration 007: User Management Enhancements
-- Adds email invitation system and proper user deletion functionality

-- 1. Enhance user_invitations table for email-based invitations
ALTER TABLE user_invitations
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Generate tokens for existing invitations without tokens
UPDATE user_invitations
SET token = encode(gen_random_bytes(32), 'hex'),
    expires_at = created_at + INTERVAL '7 days'
WHERE token IS NULL;

-- Make token required for new invitations
ALTER TABLE user_invitations
  ALTER COLUMN token SET NOT NULL;

-- 2. Create function to generate invitation tokens
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create function to validate invitation tokens
CREATE OR REPLACE FUNCTION validate_invitation_token(
  p_email TEXT,
  p_token TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation
  FROM user_invitations
  WHERE email = p_email
    AND token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  -- Return true if valid invitation found
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create function to mark invitation as accepted
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
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Mark as accepted
  UPDATE user_invitations
  SET status = 'accepted',
      accepted_at = NOW()
  WHERE id = v_invitation.id;

  -- Update user profile with invited role
  UPDATE user_profiles
  SET role = v_invitation.role
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to safely delete users (admin only)
CREATE OR REPLACE FUNCTION delete_user_safe(
  p_user_id UUID,
  p_requesting_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_requesting_user_role TEXT;
  v_result JSON;
BEGIN
  -- Check if requesting user is admin
  SELECT role INTO v_requesting_user_role
  FROM user_profiles
  WHERE id = p_requesting_user_id;

  IF v_requesting_user_role != 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admins can delete users'
    );
  END IF;

  -- Prevent self-deletion
  IF p_user_id = p_requesting_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot delete your own account'
    );
  END IF;

  -- Delete the user profile (auth user will be handled by application)
  DELETE FROM user_profiles WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'User deleted successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create index on invitation tokens for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_invitations_token
  ON user_invitations(token)
  WHERE status = 'pending';

-- 7. Create index on invitation email for duplicate checking
CREATE INDEX IF NOT EXISTS idx_user_invitations_email_status
  ON user_invitations(email, status);

-- 8. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION generate_invitation_token() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_invitation_token(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_safe(UUID, UUID) TO authenticated;

-- 9. Add RLS policies for user_invitations
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view all invitations
CREATE POLICY "Admins can view all invitations" ON user_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert invitations
CREATE POLICY "Admins can create invitations" ON user_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update invitations
CREATE POLICY "Admins can update invitations" ON user_invitations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete invitations
CREATE POLICY "Admins can delete invitations" ON user_invitations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Anonymous users can validate their invitation tokens
CREATE POLICY "Anyone can validate invitation tokens" ON user_invitations
  FOR SELECT
  TO anon
  USING (status = 'pending' AND expires_at > NOW());
