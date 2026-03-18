-- Upgrade franco@gestion-af.ca to pro plan
-- Also update Vincent and Kevin to pro plan so they're all on the same tier

UPDATE profiles
SET 
  subscription_type = 'pro',
  subscription_status = 'active'
WHERE email = 'franco@gestion-af.ca';

-- Also upgrade Vincent and Kevin to pro plan
UPDATE profiles
SET 
  subscription_type = 'pro',
  subscription_status = 'active'
WHERE email IN ('vincentb@gestion-af.ca', 'kevingw@gestion-af.ca');

-- Verify the changes
SELECT email, subscription_type, subscription_status, role
FROM profiles
WHERE company = 'gestion-af'
ORDER BY role DESC, email;
