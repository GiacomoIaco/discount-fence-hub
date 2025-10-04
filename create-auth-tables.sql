-- Authentication and User Management Tables
-- This creates the user profiles table and triggers for Supabase Auth integration

-- 1. Create user_profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sales', 'operations', 'sales-manager', 'admin')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- 2. Create user_invitations table (for inviting new users)
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sales', 'operations', 'sales-manager', 'admin')),
  invited_by UUID REFERENCES public.user_profiles(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  is_used BOOLEAN DEFAULT false
);

-- 3. Create trigger to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'sales')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_profile_updated ON public.user_profiles;
CREATE TRIGGER on_user_profile_updated
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON public.user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON public.user_invitations(token);

-- 6. Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for user_profiles
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON public.user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins and Sales Managers can insert profiles (for invitations)
CREATE POLICY "Admins and managers can create profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

-- 8. RLS Policies for user_invitations
-- Admins and Sales Managers can create invitations
CREATE POLICY "Admins and managers can create invitations"
  ON public.user_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

-- Admins and Sales Managers can view invitations
CREATE POLICY "Admins and managers can view invitations"
  ON public.user_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

-- Anyone can view their own invitation by token (for signup)
CREATE POLICY "Anyone can view invitation by token"
  ON public.user_invitations FOR SELECT
  USING (true);

-- 9. Create initial admin user (update with your actual admin email)
-- NOTE: You need to sign up through Supabase Auth first, then run this to make yourself admin
-- UPDATE public.user_profiles SET role = 'admin' WHERE email = 'your-email@example.com';

-- 10. Update sales_reps table to reference auth users (if needed for migration)
-- This creates a view that combines old sales_reps with new user_profiles
CREATE OR REPLACE VIEW public.sales_reps_view AS
SELECT
  up.id,
  up.email,
  up.full_name as name,
  up.role,
  up.phone,
  up.created_at,
  up.is_active
FROM public.user_profiles up
WHERE up.role IN ('sales', 'sales-manager', 'operations', 'admin');

COMMENT ON TABLE public.user_profiles IS 'User profiles extending Supabase Auth users';
COMMENT ON TABLE public.user_invitations IS 'Pending user invitations with tokens';
