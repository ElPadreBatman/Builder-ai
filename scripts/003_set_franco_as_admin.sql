-- Make franco@gestion-af.ca an admin
-- First, ensure the profile exists (it should have been created by the trigger)
INSERT INTO profiles (id, email, is_admin, company)
SELECT id, email, TRUE, 'gestion-af' 
FROM auth.users 
WHERE email = 'franco@gestion-af.ca'
ON CONFLICT (id) 
DO UPDATE SET is_admin = TRUE, company = 'gestion-af';
