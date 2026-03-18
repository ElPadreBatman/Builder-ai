-- Fix all RLS policies to remove references to is_admin column

-- Drop all existing problematic policies on invitations
DROP POLICY IF EXISTS "Admins and directors can view invitations for their company" ON invitations;
DROP POLICY IF EXISTS "Admins and directors can create invitations" ON invitations;
DROP POLICY IF EXISTS "Admins and directors can delete invitations" ON invitations;
DROP POLICY IF EXISTS "invitations_select_admin" ON invitations;
DROP POLICY IF EXISTS "invitations_insert_admin" ON invitations;
DROP POLICY IF EXISTS "invitations_delete_admin" ON invitations;

-- Recreate invitations policies using the non-recursive function
CREATE POLICY "invitations_select_admin"
  ON invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_profile_data() AS u
      WHERE u.user_role IN ('admin', 'director')
        AND u.user_company = invitations.company
    )
  );

CREATE POLICY "invitations_insert_admin"
  ON invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_profile_data() AS u
      WHERE u.user_role IN ('admin', 'director')
        AND u.user_company = invitations.company
    )
  );

CREATE POLICY "invitations_delete_admin"
  ON invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM get_user_profile_data() AS u
      WHERE u.user_role IN ('admin', 'director')
        AND u.user_company = invitations.company
    )
  );
