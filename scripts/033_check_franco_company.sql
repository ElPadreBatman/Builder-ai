-- Check Franco's company and see conversations from his company
SELECT id, email, company FROM profiles WHERE email = 'franco@gestion-af.ca';

-- Check all conversations created by users in gestion-af
SELECT 
  c.id, 
  c.title, 
  c.created_at,
  p.email,
  p.company
FROM conversations c
JOIN profiles p ON c.user_id = p.id
WHERE p.company = 'gestion-af'
ORDER BY c.created_at DESC;
