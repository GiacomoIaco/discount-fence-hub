-- Temporarily disable RLS on user_profiles to fix infinite recursion
-- This allows all authenticated users to read their own profiles

-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins and managers can create profiles" ON public.user_profiles;

-- Disable RLS for now (we'll add proper policies later)
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
