-- Fix infinite recursion in profiles RLS policy
-- The issue is that the policy references the profiles table itself,
-- causing a recursive loop when checking the policy.

-- Solution: Create a SECURITY DEFINER function that bypasses RLS
-- to get the current user's company

-- First, drop the problematic policy
DROP POLICY IF EXISTS "Users can view company profiles" ON profiles;

-- Create a function with SECURITY DEFINER that can read profiles without RLS
CREATE OR REPLACE FUNCTION get_my_company()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company FROM profiles WHERE id = auth.uid()
$$;

-- Now create the policy using the function instead of a subquery
CREATE POLICY "Users can view company profiles"
ON profiles FOR SELECT
USING (
  -- User can view their own profile
  auth.uid() = id
  OR
  -- User can view profiles from same company (using function to avoid recursion)
  (company IS NOT NULL AND company = get_my_company())
);

-- Verify the fix
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles';
