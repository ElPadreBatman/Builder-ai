-- Manually confirm email for existing user
-- This updates the email_confirmed_at field in auth.users

UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email = 'franco@fondation-alayn-lepage.ca'
  AND email_confirmed_at IS NULL;

-- Verify the update
SELECT email, email_confirmed_at 
FROM auth.users 
WHERE email = 'franco@fondation-alayn-lepage.ca';
