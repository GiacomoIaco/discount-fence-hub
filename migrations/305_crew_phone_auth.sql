-- Migration 305: Support phone-only auth for crew members
-- Enables Supabase Phone OTP login. Phone auth creates auth.users with
-- phone but possibly NULL email. The handle_new_user trigger must handle this.
--
-- CHANGES:
-- 1. Make user_profiles.email nullable (phone-only users have no email)
-- 2. Update handle_new_user to extract phone from NEW.phone (set by phone auth)
-- 3. Auto-set crew defaults: preferred_language='es', approval_status='approved',
--    onboarding_completed_at=NOW()

-- ============================================================================
-- 1. Make email nullable on user_profiles
-- ============================================================================
ALTER TABLE user_profiles ALTER COLUMN email DROP NOT NULL;

-- ============================================================================
-- 2. Updated handle_new_user: supports phone-only signups
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
  v_phone TEXT;
  v_email TEXT;
  v_full_name TEXT;
BEGIN
  -- Extract metadata from signup
  v_raw_role := COALESCE(NEW.raw_user_meta_data->>'role', 'sales');
  v_approval := COALESCE(NEW.raw_user_meta_data->>'approval_status', 'pending');

  -- Phone: phone auth sets NEW.phone directly; email/password signups may pass phone in metadata
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');

  -- Email: may be NULL for phone-only signups
  v_email := NEW.email;

  -- Full name: default to 'Crew Member' for phone-only signups (no metadata name)
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Crew Member');

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

  -- Crew members get auto-approved and skip onboarding
  IF v_app_role = 'crew' THEN
    v_approval := 'approved';
  END IF;

  -- Create user profile (with legacy role value)
  INSERT INTO public.user_profiles (id, email, full_name, role, phone, approval_status, preferred_language, onboarding_completed_at)
  VALUES (
    NEW.id,
    v_email,
    v_full_name,
    v_legacy_role,
    v_phone,
    v_approval,
    CASE WHEN v_app_role = 'crew' THEN 'es' ELSE 'en' END,
    CASE WHEN v_app_role = 'crew' THEN NOW() ELSE NULL END
  );

  -- Create user_roles entry (source of truth for permissions)
  INSERT INTO public.user_roles (user_id, role_key)
  VALUES (NEW.id, v_app_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
