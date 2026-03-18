-- Add status column to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status text DEFAULT 'en_cours';

-- Add current_conversation_id to profiles for presence tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;

-- Add is_typing to profiles for typing indicator
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_typing boolean DEFAULT false;

-- Create index for efficient lookup of users in a conversation
CREATE INDEX IF NOT EXISTS idx_profiles_current_conversation ON profiles(current_conversation_id) WHERE current_conversation_id IS NOT NULL;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
