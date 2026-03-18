-- Test RLS policy for Franco viewing Vincent's conversations
-- This simulates what Franco should see with the current RLS policy

SELECT 
  c.id,
  c.title,
  c.user_id,
  owner_profile.email as owner_email,
  owner_profile.company as owner_company,
  viewer_profile.email as viewer_email,
  viewer_profile.company as viewer_company,
  (owner_profile.company = viewer_profile.company) as should_be_visible
FROM conversations c
JOIN profiles as owner_profile ON c.user_id = owner_profile.id
CROSS JOIN (
  SELECT id, email, company FROM profiles WHERE email = 'franco@gestion-af.ca'
) as viewer_profile
WHERE owner_profile.company = viewer_profile.company
ORDER BY c.updated_at DESC
LIMIT 10;
