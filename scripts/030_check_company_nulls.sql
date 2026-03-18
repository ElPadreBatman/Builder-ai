-- Check if company column has NULL values and fix them
-- Also verify the RLS is working properly

-- First, let's see all users and their company status
SELECT 
  id,
  email,
  company,
  CASE WHEN company IS NULL THEN 'NULL' ELSE 'SET' END as company_status
FROM profiles
ORDER BY email;
