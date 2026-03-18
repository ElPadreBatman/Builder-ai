-- Fix RLS policies for invitations table to allow sellers to create invitations

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view invitations they created" ON invitations;
DROP POLICY IF EXISTS "Users can create invitations" ON invitations;
DROP POLICY IF EXISTS "Users can update their invitations" ON invitations;
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON invitations;
DROP POLICY IF EXISTS "Admins and sellers can create invitations" ON invitations;
DROP POLICY IF EXISTS "Admins and sellers can view their invitations" ON invitations;
DROP POLICY IF EXISTS "Admins and sellers can update their invitations" ON invitations;

-- Create new policies that allow admins and sellers to manage invitations

-- Policy: Admins and sellers can INSERT invitations
CREATE POLICY "Admins and sellers can create invitations" ON invitations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'seller')
    )
  );

-- Policy: Users can view invitations they created OR that were created for them
CREATE POLICY "Users can view their invitations" ON invitations
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      invited_by = auth.uid()
      OR seller_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'seller')
      )
    )
  );

-- Policy: Anyone can view invitation by token (for accepting invitations)
CREATE POLICY "Anyone can view invitation by token" ON invitations
  FOR SELECT
  USING (true);

-- Policy: Admins and sellers can UPDATE their invitations
CREATE POLICY "Admins and sellers can update invitations" ON invitations
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      invited_by = auth.uid()
      OR seller_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'seller')
      )
    )
  );

-- Policy: Admins and sellers can DELETE their invitations
CREATE POLICY "Admins and sellers can delete invitations" ON invitations
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      invited_by = auth.uid()
      OR seller_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
      )
    )
  );

-- Make sure RLS is enabled
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Verify policies
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'invitations';
