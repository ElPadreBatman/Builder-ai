-- Fix missing profile for existing user and ensure trigger works correctly

-- First, drop the existing check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_type_check;

-- Update any existing invalid subscription_type values to 'free'
UPDATE public.profiles 
SET subscription_type = 'free' 
WHERE subscription_type IS NULL OR subscription_type NOT IN ('free', 'base', 'pro');

-- Now add the check constraint
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_type_check 
  CHECK (subscription_type IN ('free', 'base', 'pro'));

-- Create missing profiles for users that exist in auth.users but not in profiles
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
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'first_name', SPLIT_PART(COALESCE(u.raw_user_meta_data->>'full_name', ''), ' ', 1)),
  COALESCE(
    u.raw_user_meta_data->>'last_name',
    CASE 
      WHEN POSITION(' ' IN COALESCE(u.raw_user_meta_data->>'full_name', '')) > 0 
      THEN SUBSTRING(COALESCE(u.raw_user_meta_data->>'full_name', '') FROM POSITION(' ' IN COALESCE(u.raw_user_meta_data->>'full_name', '')) + 1)
      ELSE ''
    END
  ),
  u.raw_user_meta_data->>'company',
  COALESCE(u.raw_user_meta_data->>'role', 'admin'),
  'trialing',
  COALESCE(u.raw_user_meta_data->>'plan', 'free'),
  NOW() + INTERVAL '7 days',
  NOW(),
  NOW()
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Now recreate the trigger function with proper error handling and permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
END;
$$;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions to supabase_auth_admin (required for the trigger to work)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.profiles TO supabase_auth_admin;

-- Also grant to authenticated and anon for RLS to work
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
