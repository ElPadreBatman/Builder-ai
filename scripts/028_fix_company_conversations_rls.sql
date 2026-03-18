-- Fix RLS policies for conversations to allow viewing company-wide conversations
-- Users in the same company should be able to see all conversations from their company

-- Drop old policies that only allowed viewing own conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view company conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update company conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete company conversations" ON conversations;

-- Create new policy: Users can view all conversations from users in the same company
CREATE POLICY "Users can view company conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles viewer
      JOIN profiles owner ON viewer.company = owner.company
      WHERE viewer.id = auth.uid()
      AND owner.id = conversations.user_id
    )
  );

-- Create new policy: Users can update conversations from their company
CREATE POLICY "Users can update company conversations"
  ON conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles viewer
      JOIN profiles owner ON viewer.company = owner.company
      WHERE viewer.id = auth.uid()
      AND owner.id = conversations.user_id
    )
  );

-- Create new policy: Users can delete conversations from their company
CREATE POLICY "Users can delete company conversations"
  ON conversations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles viewer
      JOIN profiles owner ON viewer.company = owner.company
      WHERE viewer.id = auth.uid()
      AND owner.id = conversations.user_id
    )
  );

-- Keep the insert policy as-is (users can only insert their own conversations)
-- This already exists but let's make sure it's correct
DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;
CREATE POLICY "Users can insert their own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Also fix messages policies to allow viewing company messages
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON messages;
DROP POLICY IF EXISTS "Users can view company messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert company messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

-- Messages: Users can view messages from company conversations
CREATE POLICY "Users can view company messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN profiles viewer ON viewer.id = auth.uid()
      JOIN profiles owner ON owner.id = c.user_id
      WHERE c.id = messages.conversation_id
      AND viewer.company = owner.company
    )
  );

-- Messages: Users can insert messages to company conversations
CREATE POLICY "Users can insert company messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN profiles viewer ON viewer.id = auth.uid()
      JOIN profiles owner ON owner.id = c.user_id
      WHERE c.id = messages.conversation_id
      AND viewer.company = owner.company
    )
  );

-- Messages: Users can delete their own messages only
CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );
