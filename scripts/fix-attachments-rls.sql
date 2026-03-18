-- Fix RLS policies on attachments table to allow all team members to access attachments
-- Currently, only the conversation owner can access attachments
-- This should be: any user from the same company/team can access attachments

-- Drop existing attachment policies
DROP POLICY IF EXISTS "Users can view attachments from their messages" ON attachments;
DROP POLICY IF EXISTS "Users can insert attachments to their messages" ON attachments;
DROP POLICY IF EXISTS "Users can delete attachments from their messages" ON attachments;

-- Create new policies that check company membership instead
-- View: Users can view attachments from conversations their company has access to
CREATE POLICY "Users can view attachments from company conversations"
  ON attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN profiles conv_owner ON conv_owner.id = c.user_id
      JOIN profiles auth_user ON auth_user.id = auth.uid()
      WHERE m.id = attachments.message_id
        AND conv_owner.company = auth_user.company
    )
  );

-- Insert: Users can insert attachments to conversations their company has access to
CREATE POLICY "Users can insert attachments to company conversations"
  ON attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN profiles conv_owner ON conv_owner.id = c.user_id
      JOIN profiles auth_user ON auth_user.id = auth.uid()
      WHERE m.id = attachments.message_id
        AND conv_owner.company = auth_user.company
    )
  );

-- Delete: Users can delete attachments from conversations their company has access to
CREATE POLICY "Users can delete attachments from company conversations"
  ON attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN profiles conv_owner ON conv_owner.id = c.user_id
      JOIN profiles auth_user ON auth_user.id = auth.uid()
      WHERE m.id = attachments.message_id
        AND conv_owner.company = auth_user.company
    )
  );
