-- Migration 014: Add conversation_artifacts table for storing extracted project data
-- This table stores values extracted automatically by AI from messages and attachments

-- First, ensure conversations have a status column for dashboard filtering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'status'
  ) THEN
    ALTER TABLE conversations ADD COLUMN status text DEFAULT 'brouillon';
  END IF;
END $$;

-- Create index on status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

-- Table for storing extracted artifacts from conversations
CREATE TABLE IF NOT EXISTS conversation_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  category text NOT NULL, -- 'projet', 'dimensions', 'quantites', 'materiaux'
  key text NOT NULL, -- 'nom', 'adresse', 'superficie', 'prises', etc.
  value text, -- The extracted value
  unit text, -- 'pi2', 'pi', 'm2', 'u', etc.
  confidence real DEFAULT 1.0, -- AI confidence score (0-1)
  source text DEFAULT 'ai', -- 'ai', 'manual', 'attachment'
  source_id uuid, -- Reference to message or attachment ID
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, category, key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_artifacts_conversation ON conversation_artifacts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_category ON conversation_artifacts(category);

-- Enable RLS
ALTER TABLE conversation_artifacts ENABLE ROW LEVEL SECURITY;

-- RLS policies: Users can access artifacts from conversations in their company
CREATE POLICY "artifacts_select_policy"
ON conversation_artifacts FOR SELECT
USING (
  conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN profiles p ON c.user_id = p.id
    WHERE p.company = (SELECT company FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "artifacts_insert_policy"
ON conversation_artifacts FOR INSERT
WITH CHECK (
  conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN profiles p ON c.user_id = p.id
    WHERE p.company = (SELECT company FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "artifacts_update_policy"
ON conversation_artifacts FOR UPDATE
USING (
  conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN profiles p ON c.user_id = p.id
    WHERE p.company = (SELECT company FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "artifacts_delete_policy"
ON conversation_artifacts FOR DELETE
USING (
  conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN profiles p ON c.user_id = p.id
    WHERE p.company = (SELECT company FROM profiles WHERE id = auth.uid())
  )
);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_artifacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS artifacts_updated_at ON conversation_artifacts;
CREATE TRIGGER artifacts_updated_at
  BEFORE UPDATE ON conversation_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION update_artifacts_updated_at();
