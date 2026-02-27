-- Migration 277: Dual-write trigger + updated approve_user RPC
-- Phase 2 of User Identity Consolidation
--
-- Creates a trigger that syncs user_roles.role_key -> user_profiles.role (legacy)
-- Updates approve_user to write to user_roles (trigger handles legacy sync)

-- ============================================================================
-- Step 1: Dual-write trigger (user_roles.role_key -> user_profiles.role)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_user_role_to_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_legacy_role TEXT;
BEGIN
  -- Map AppRole -> legacy role string
  v_legacy_role := CASE NEW.role_key
    WHEN 'owner' THEN 'admin'
    WHEN 'admin' THEN 'admin'
    WHEN 'sales_manager' THEN 'sales-manager'
    WHEN 'sales_rep' THEN 'sales'
    WHEN 'front_desk' THEN 'sales'
    WHEN 'ops_manager' THEN 'operations'
    WHEN 'operations' THEN 'operations'
    WHEN 'yard' THEN 'yard'
    WHEN 'crew' THEN 'yard'
    ELSE 'sales'
  END;

  -- Sync to user_profiles.role
  UPDATE user_profiles
  SET role = v_legacy_role
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on INSERT and UPDATE to user_roles
DROP TRIGGER IF EXISTS trg_sync_user_role_to_profile ON user_roles;
CREATE TRIGGER trg_sync_user_role_to_profile
  AFTER INSERT OR UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_role_to_profile();

-- ============================================================================
-- Step 2: Updated approve_user RPC (writes to user_roles)
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_user(
  p_user_id UUID,
  p_approving_user_id UUID,
  p_role TEXT DEFAULT 'sales_rep'
)
RETURNS JSON AS $$
DECLARE
  v_approver_role TEXT;
  v_user_email TEXT;
  v_user_name TEXT;
BEGIN
  -- Check if approving user has manage_team permission (via user_roles)
  -- Fall back to legacy admin check for backward compatibility
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_key = ur.role_key
    WHERE ur.user_id = p_approving_user_id
      AND rp.permission_key = 'manage_team'
  ) THEN
    -- Legacy fallback: check user_profiles.role
    SELECT role INTO v_approver_role
    FROM user_profiles
    WHERE id = p_approving_user_id;

    IF v_approver_role NOT IN ('admin', 'sales-manager') THEN
      RETURN json_build_object(
        'success', false,
        'error', 'You do not have permission to approve users'
      );
    END IF;
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

  -- Update approval status on user_profiles
  UPDATE user_profiles
  SET
    approval_status = 'approved',
    approved_at = NOW(),
    approved_by = p_approving_user_id,
    is_active = true
  WHERE id = p_user_id;

  -- Upsert into user_roles (trigger handles syncing to user_profiles.role)
  INSERT INTO user_roles (user_id, role_key, assigned_by)
  VALUES (p_user_id, p_role::TEXT, p_approving_user_id)
  ON CONFLICT (user_id) DO UPDATE
  SET role_key = EXCLUDED.role_key,
      assigned_by = EXCLUDED.assigned_by,
      assigned_at = NOW();

  RETURN json_build_object(
    'success', true,
    'email', v_user_email,
    'name', v_user_name,
    'role', p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
