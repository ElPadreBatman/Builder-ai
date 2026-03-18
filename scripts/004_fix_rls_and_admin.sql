-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create simpler RLS policies without recursion
-- Allow users to view their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow users to insert their own profile (for the trigger)
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create or update profile for franco@gestion-af.ca as admin
-- First, we need to get the user ID
DO $$
DECLARE
  franco_user_id UUID;
BEGIN
  -- Get franco's user ID from auth.users
  SELECT id INTO franco_user_id
  FROM auth.users
  WHERE email = 'franco@gestion-af.ca';
  
  -- If user exists, create or update profile
  IF franco_user_id IS NOT NULL THEN
    INSERT INTO profiles (id, email, is_admin, company)
    VALUES (franco_user_id, 'franco@gestion-af.ca', TRUE, 'gestion-af')
    ON CONFLICT (id) 
    DO UPDATE SET 
      is_admin = TRUE,
      company = 'gestion-af',
      updated_at = NOW();
    
    RAISE NOTICE 'Profile created/updated for franco@gestion-af.ca as admin';
  ELSE
    RAISE NOTICE 'User franco@gestion-af.ca not found in auth.users';
  END IF;
END $$;
