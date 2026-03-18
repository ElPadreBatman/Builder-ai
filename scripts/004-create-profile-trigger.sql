-- Create a trigger to automatically create a profile when a new user signs up
-- This ensures the profile is created in the same transaction as the auth.users insert

-- First, create the function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
BEGIN
  -- Extract full name from metadata
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  
  -- Get first and last name from metadata or parse from full name
  v_first_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    SPLIT_PART(v_full_name, ' ', 1)
  );
  
  v_last_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    CASE 
      WHEN POSITION(' ' IN v_full_name) > 0 
      THEN SUBSTRING(v_full_name FROM POSITION(' ' IN v_full_name) + 1)
      ELSE ''
    END
  );

  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    company,
    role,
    subscription_status,
    subscription_type,
    trial_end_date,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    NEW.raw_user_meta_data->>'company',
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    'trialing',
    COALESCE(NEW.raw_user_meta_data->>'plan', 'free'),
    NOW() + INTERVAL '7 days',
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.profiles TO supabase_auth_admin;
