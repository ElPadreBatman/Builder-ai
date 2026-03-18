-- Check current RLS policies on conversations
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'conversations'
ORDER BY policyname;
