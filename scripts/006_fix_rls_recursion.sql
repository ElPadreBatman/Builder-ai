-- Fix infinite recursion in RLS policies for profiles table
-- The problem: policies that query the profiles table from within profiles policies

-- Drop all existing problematic policies on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins and directors can view all profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins and directors can update profiles in their company" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- Create non-recursive RLS policies for profiles
-- Users can always view and update their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- For admin access, we'll use a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION is_admin_or_director()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN user_role IN ('admin', 'director');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin/Director can view all profiles in their company using the function
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  USING (
    is_admin_or_director() AND
    company = (SELECT company FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- Admin/Director can update profiles in their company
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (
    is_admin_or_director() AND
    company = (SELECT company FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- Update invitations policies to use the function
DROP POLICY IF EXISTS "Admins and directors can view invitations for their company" ON invitations;
DROP POLICY IF EXISTS "Admins and directors can create invitations" ON invitations;
DROP POLICY IF EXISTS "Admins and directors can delete invitations" ON invitations;

CREATE POLICY "invitations_select_admin"
  ON invitations FOR SELECT
  USING (
    is_admin_or_director() AND
    company = (SELECT company FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "invitations_insert_admin"
  ON invitations FOR INSERT
  WITH CHECK (
    is_admin_or_director() AND
    invited_by = auth.uid()
  );

CREATE POLICY "invitations_delete_admin"
  ON invitations FOR DELETE
  USING (
    is_admin_or_director() AND
    company = (SELECT company FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- Ensure franco@gestion-af.ca is set as admin with director role
DO $$
DECLARE
  franco_user_id UUID;
BEGIN
  SELECT id INTO franco_user_id
  FROM auth.users
  WHERE email = 'franco@gestion-af.ca';
  
  IF franco_user_id IS NOT NULL THEN
    INSERT INTO profiles (id, email, is_admin, role, company, subscription_type)
    VALUES (franco_user_id, 'franco@gestion-af.ca', TRUE, 'admin', 'gestion-af', 'entreprise')
    ON CONFLICT (id) 
    DO UPDATE SET 
      is_admin = TRUE,
      role = 'admin',
      company = 'gestion-af',
      subscription_type = 'entreprise',
      updated_at = NOW();
    
    RAISE NOTICE 'Profile created/updated for franco@gestion-af.ca as admin';
  ELSE
    RAISE NOTICE 'User franco@gestion-af.ca not found in auth.users. Please sign up first.';
  END IF;
END $$;
