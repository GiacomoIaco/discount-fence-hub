-- Migration 287: Fix handle_new_user trigger to create user_roles entry
-- After identity system consolidation (Feb 26), user_roles.role_key is the
-- source of truth for permissions/menus. The old trigger only created
-- user_profiles, leaving new users without any role entry.
--
-- ISSUES FIXED:
-- 1. search_path: RLS policies reference user_profiles without schema prefix.
--    When trigger fires from auth schema context, search_path doesn't include
--    'public'. Fixed with SET search_path = public.
-- 2. CHECK constraint: user_profiles.role only allows legacy values
--    ('sales','operations','sales-manager','admin'). The trigger must map
--    incoming role to a legacy value for user_profiles, and use AppRole for
--    user_roles.
-- 3. sync_user_role_to_profile also needs SET search_path = public.
-- 4. Deprecated auto_match_user_salesperson trigger removed.

-- ============================================================================
-- 1. Updated handle_new_user: creates BOTH user_profiles AND user_roles
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $function$
DECLARE
  v_raw_role TEXT;
  v_legacy_role TEXT;
  v_app_role TEXT;
  v_approval TEXT;
BEGIN
  -- Extract metadata from signup
  v_raw_role := COALESCE(NEW.raw_user_meta_data->>'role', 'sales');
  v_approval := COALESCE(NEW.raw_user_meta_data->>'approval_status', 'pending');

  -- Map to AppRole (for user_roles table)
  v_app_role := CASE v_raw_role
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

  -- Map to legacy role (for user_profiles.role CHECK constraint)
  -- Only 4 values allowed: 'sales', 'operations', 'sales-manager', 'admin'
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

  -- Create user profile (with legacy role value)
  INSERT INTO public.user_profiles (id, email, full_name, role, phone, approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    v_legacy_role,
    NEW.raw_user_meta_data->>'phone',
    v_approval
  );

  -- Create user_roles entry (source of truth for permissions)
  INSERT INTO public.user_roles (user_id, role_key)
  VALUES (NEW.id, v_app_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 2. Fix sync_user_role_to_profile: add SET search_path = public
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_user_role_to_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_legacy_role TEXT;
BEGIN
  v_legacy_role := CASE NEW.role_key
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

  UPDATE user_profiles SET role = v_legacy_role WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 3. Disable deprecated auto_match_user_salesperson trigger
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_auto_match_salesperson ON public.user_profiles;
