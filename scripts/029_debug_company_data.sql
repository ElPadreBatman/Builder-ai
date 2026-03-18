-- Debug script to check company assignments
SELECT 
  id, 
  email, 
  company, 
  first_name, 
  last_name,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 20;
