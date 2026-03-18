-- Fix RLS policies for profiles table
-- The 406 error indicates the user can't access their own profile

-- First, drop existing policies that might be conflicting
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_company" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_by_admin" ON public.profiles;

-- Recreate the policies with correct configuration

-- Policy 1: Users can always see their own profile
CREATE POLICY "profiles_select_own" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Policy 2: Users can see profiles from the same company
CREATE POLICY "profiles_select_same_company" 
ON public.profiles 
FOR SELECT 
USING (
  company IS NOT NULL 
  AND company = (SELECT company FROM public.profiles WHERE id = auth.uid())
);

-- Policy 3: Super admins can see all profiles
CREATE POLICY "profiles_select_by_admin" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

-- Verify RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
