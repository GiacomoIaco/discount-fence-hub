-- Migration 279: Remove legacy role fallback
-- Phase 7 of User Identity Consolidation
--
-- 1. Backfill user_roles for any users without entries
-- 2. Rewrite is_current_user_admin() to use new permission system
-- 3. Fix user_has_permission super admin check (use 'id' not 'user_id')

-- Step 1: Backfill user_roles from user_profiles.role for any users who don't have entries
INSERT INTO user_roles (user_id, role_key)
SELECT up.id,
  CASE up.role
    WHEN 'admin' THEN 'admin'
    WHEN 'sales-manager' THEN 'sales_manager'
    WHEN 'sales' THEN 'sales_rep'
    WHEN 'operations' THEN 'operations'
    WHEN 'yard' THEN 'yard'
    ELSE 'operations'
  END
FROM user_profiles up
WHERE up.approval_status = 'approved'
  AND up.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = up.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Rewrite is_current_user_admin() to use new permission system
-- This fixes all RLS policies that call this function (e.g., user_profiles policies)
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admin always has access
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true) THEN
    RETURN true;
  END IF;

  -- Check new permission system: owner/admin roles have manage_settings
  IF EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON ur.role_key = rp.role_key
    WHERE ur.user_id = auth.uid()
      AND rp.permission_key = 'manage_settings'
  ) THEN
    RETURN true;
  END IF;

  -- Legacy fallback during transition (dual-write keeps this in sync)
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 3: Fix user_has_permission super admin check
-- Original migration 230 used 'user_id' but user_profiles PK is 'id'
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admin check first (use 'id' column, not 'user_id')
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = p_user_id AND is_super_admin = true) THEN
    RETURN true;
  END IF;

  -- Check for explicit revoke override
  IF EXISTS (
    SELECT 1 FROM user_permission_overrides
    WHERE user_id = p_user_id
      AND permission_key = p_permission
      AND override_type = 'revoke'
  ) THEN
    RETURN false;
  END IF;

  -- Check for explicit grant override
  IF EXISTS (
    SELECT 1 FROM user_permission_overrides
    WHERE user_id = p_user_id
      AND permission_key = p_permission
      AND override_type = 'grant'
  ) THEN
    RETURN true;
  END IF;

  -- Check role permissions
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON ur.role_key = rp.role_key
    WHERE ur.user_id = p_user_id AND rp.permission_key = p_permission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

SELECT 'Migration 279 complete: Legacy role fallback removed, permission system is primary';
