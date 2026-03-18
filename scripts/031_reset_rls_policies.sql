-- Reset all RLS policies for conversations and messages tables
-- Start completely fresh to ensure no conflicting policies

-- Disable RLS temporarily
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (be comprehensive)
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view company conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update company conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete company conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;

DROP POLICY IF EXISTS "Users can view messages from their conversations" ON messages;
DROP POLICY IF EXISTS "Users can view company messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert company messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

-- === CONVERSATIONS TABLE ===

-- Policy 1: Users can view all conversations from their company
CREATE POLICY "view_company_conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles viewer
      WHERE viewer.id = auth.uid()
      AND viewer.company IS NOT NULL
      AND viewer.company = (
        SELECT owner.company FROM profiles owner WHERE owner.id = conversations.user_id
      )
    )
  );

-- Policy 2: Users can insert their own conversations
CREATE POLICY "insert_own_conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update conversations from their company
CREATE POLICY "update_company_conversations"
  ON conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles viewer
      WHERE viewer.id = auth.uid()
      AND viewer.company IS NOT NULL
      AND viewer.company = (
        SELECT owner.company FROM profiles owner WHERE owner.id = conversations.user_id
      )
    )
  );

-- Policy 4: Users can delete conversations from their company
CREATE POLICY "delete_company_conversations"
  ON conversations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles viewer
      WHERE viewer.id = auth.uid()
      AND viewer.company IS NOT NULL
      AND viewer.company = (
        SELECT owner.company FROM profiles owner WHERE owner.id = conversations.user_id
      )
    )
  );

-- === MESSAGES TABLE ===

-- Policy 1: Users can view messages from company conversations
CREATE POLICY "view_company_messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN profiles viewer ON viewer.id = auth.uid()
      WHERE c.id = messages.conversation_id
      AND viewer.company IS NOT NULL
      AND viewer.company = (
        SELECT owner.company FROM profiles owner WHERE owner.id = c.user_id
      )
    )
  );

-- Policy 2: Users can insert messages to company conversations
CREATE POLICY "insert_company_messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN profiles viewer ON viewer.id = auth.uid()
      WHERE c.id = messages.conversation_id
      AND viewer.company IS NOT NULL
      AND viewer.company = (
        SELECT owner.company FROM profiles owner WHERE owner.id = c.user_id
      )
    )
  );

-- Policy 3: Users can delete their own messages only
CREATE POLICY "delete_own_messages"
  ON messages FOR DELETE
  USING (auth.uid() = user_id);

-- Policy 4: Users can update their own messages only
CREATE POLICY "update_own_messages"
  ON messages FOR UPDATE
  USING (auth.uid() = user_id);
