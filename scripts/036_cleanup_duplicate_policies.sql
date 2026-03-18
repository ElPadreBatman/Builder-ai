-- Remove the old restrictive SELECT policy that only allowed viewing own profile
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;

-- Verify remaining policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';
