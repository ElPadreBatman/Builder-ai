-- Script to configure a user as a seller
-- Replace 'franco@factorialevolution.ca' with the actual seller email

-- Step 1: Set an existing user as a seller by email
UPDATE profiles 
SET role = 'seller' 
WHERE email = 'franco@factorialevolution.ca';

-- Step 2: Create seller record if not exists (delete existing first to avoid conflicts)
DELETE FROM sellers 
WHERE user_id = (SELECT id FROM profiles WHERE email = 'franco@factorialevolution.ca');

INSERT INTO sellers (user_id, commission_rate, is_active, total_sales, total_commission)
SELECT id, 10.0, true, 0, 0 
FROM profiles 
WHERE email = 'franco@factorialevolution.ca';

-- Verify the setup
SELECT p.email, p.role, s.id as seller_id, s.commission_rate, s.is_active
FROM profiles p
LEFT JOIN sellers s ON s.user_id = p.id
WHERE p.email = 'franco@factorialevolution.ca';
