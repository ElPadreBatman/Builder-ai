-- Create a trigger function to automatically set first user as company admin
CREATE OR REPLACE FUNCTION set_first_user_as_admin()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  user_email TEXT;
  company_name TEXT;
BEGIN
  -- Get the user's email
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  
  -- Extract company name from email domain
  company_name := split_part(user_email, '@', 2);
  
  -- Count existing users in this company
  SELECT COUNT(*) INTO user_count 
  FROM profiles 
  WHERE company = company_name;
  
  -- Removed is_admin references, use only role column
  -- If this is the first user in the company, make them admin
  IF user_count = 0 THEN
    NEW.is_super_admin := FALSE;
    NEW.role := 'admin';
    NEW.company := company_name;
    NEW.subscription_type := 'base'; -- Default to base plan
  ELSE
    -- Not the first user, default to employee
    NEW.is_super_admin := FALSE;
    NEW.role := 'employee';
    NEW.company := company_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new profile inserts
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_first_user_as_admin();

-- Removed is_admin reference, use only role and is_super_admin
-- Update existing franco@gestion-af.ca to be super admin
UPDATE profiles
SET is_super_admin = TRUE,
    role = 'admin'
WHERE email = 'franco@gestion-af.ca';
