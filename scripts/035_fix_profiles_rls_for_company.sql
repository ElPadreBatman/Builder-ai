-- Fix profiles RLS to allow viewing users from the same company
-- This allows admins to see all team members and all users to see colleagues

-- First check current policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';

-- Drop existing view policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view company profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Create new policy: users can view profiles from the same company
CREATE POLICY "Users can view company profiles"
ON profiles FOR SELECT
USING (
  -- User can view their own profile
  auth.uid() = id
  OR
  -- User can view profiles from same company
  company IS NOT NULL AND company = (
    SELECT company FROM profiles WHERE id = auth.uid()
  )
);

-- Keep existing update policy (users can only update their own profile)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Verify new policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';
