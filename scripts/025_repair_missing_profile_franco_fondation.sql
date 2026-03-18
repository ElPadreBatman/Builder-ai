-- Repair missing profile for franco@fondation-alayn-lepage.ca
-- User exists in auth.users but not in profiles table
-- Stripe customer created: cus_U8xdOu3P3kxcxK

-- First, get the user ID from auth.users
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = 'franco@fondation-alayn-lepage.ca';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User not found in auth.users';
    RETURN;
  END IF;

  -- Insert the profile
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    company,
    phone,
    role,
    specialty,
    subscription_status,
    subscription_type,
    trial_end_date,
    stripe_customer_id,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    'franco@fondation-alayn-lepage.ca',
    'Franco Guinazu',
    'Franco',
    'Guinazu',
    'fondation-alayn-lepage.ca',
    '',
    'admin',
    'general',
    'trialing',
    'free',
    NOW() + INTERVAL '7 days',
    'cus_U8xdOu3P3kxcxK',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    stripe_customer_id = 'cus_U8xdOu3P3kxcxK',
    updated_at = NOW();

  RAISE NOTICE 'Profile created/updated for user %', v_user_id;
END $$;
