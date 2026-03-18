-- Update the handle_new_user trigger to include specialty
-- This ensures new users get their specialty saved from metadata

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the function with specialty support and proper full_name parsing
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  
  INSERT INTO public.profiles (
    id, 
    email, 
    company,
    role,
    first_name,
    last_name,
    specialty,
    subscription_status,
    subscription_type,
    trial_end_date
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'company', 'default-company'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    COALESCE(
      NEW.raw_user_meta_data->>'first_name',
      SPLIT_PART(v_full_name, ' ', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'last_name',
      CASE 
        WHEN POSITION(' ' IN v_full_name) > 0
        THEN SUBSTRING(v_full_name FROM POSITION(' ' IN v_full_name) + 1)
        ELSE ''
      END
    ),
    COALESCE(NEW.raw_user_meta_data->>'specialty', 'general'),
    'trialing',
    COALESCE(NEW.raw_user_meta_data->>'plan', 'free'),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
