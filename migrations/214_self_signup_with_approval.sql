-- Migration 213: Self-Signup with Admin Approval
-- Allows users to sign up without invitation, pending admin approval

-- 1. Add approval_status to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Set existing users as approved
UPDATE user_profiles SET approval_status = 'approved' WHERE approval_status IS NULL;

-- 2. Add onboarding tracking
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Set approved_at for existing users to their created_at
UPDATE user_profiles
SET approved_at = created_at
WHERE approval_status = 'approved' AND approved_at IS NULL;

-- 3. Create index for pending approvals lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_status
  ON user_profiles(approval_status)
  WHERE approval_status = 'pending';

-- 4. Create function to approve a user
CREATE OR REPLACE FUNCTION approve_user(
  p_user_id UUID,
  p_approving_user_id UUID,
  p_role TEXT DEFAULT 'sales'
)
RETURNS JSON AS $$
DECLARE
  v_approver_role TEXT;
  v_user_email TEXT;
  v_user_name TEXT;
BEGIN
  -- Check if approving user is admin
  SELECT role INTO v_approver_role
  FROM user_profiles
  WHERE id = p_approving_user_id;

  IF v_approver_role != 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admins can approve users'
    );
  END IF;

  -- Get user info for notification
  SELECT email, full_name INTO v_user_email, v_user_name
  FROM user_profiles
  WHERE id = p_user_id AND approval_status = 'pending';

  IF v_user_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found or already processed'
    );
  END IF;

  -- Update the user
  UPDATE user_profiles
  SET
    approval_status = 'approved',
    role = p_role,
    approved_at = NOW(),
    approved_by = p_approving_user_id,
    is_active = true
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'email', v_user_email,
    'name', v_user_name,
    'role', p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to reject a user
CREATE OR REPLACE FUNCTION reject_user(
  p_user_id UUID,
  p_rejecting_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_approver_role TEXT;
BEGIN
  -- Check if rejecting user is admin
  SELECT role INTO v_approver_role
  FROM user_profiles
  WHERE id = p_rejecting_user_id;

  IF v_approver_role != 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admins can reject users'
    );
  END IF;

  -- Update the user
  UPDATE user_profiles
  SET
    approval_status = 'rejected',
    rejection_reason = p_reason,
    is_active = false
  WHERE id = p_user_id AND approval_status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found or already processed'
    );
  END IF;

  RETURN json_build_object(
    'success', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION approve_user(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_user(UUID, UUID, TEXT) TO authenticated;

-- 7. Update RLS policy to allow pending users to see their own profile
-- (they need to see their approval_status)
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 8. Policy for admins to see pending users
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 9. Allow admins to update any profile (for approval)
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
CREATE POLICY "Admins can update all profiles" ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
