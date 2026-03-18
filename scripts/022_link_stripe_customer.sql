-- Update the profile for lesconstructionshamelfils@outlook.com with the Stripe customer ID
UPDATE public.profiles
SET stripe_customer_id = 'cus_U8kBhMbKkuZKEs'
WHERE email = 'lesconstructionshamelfils@outlook.com';

-- Verify the update
SELECT id, email, stripe_customer_id FROM public.profiles 
WHERE email = 'lesconstructionshamelfils@outlook.com';
