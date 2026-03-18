-- Add summary column to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id);

-- Create function to update message count
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conversations 
    SET message_count = message_count + 1,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE conversations 
    SET message_count = GREATEST(message_count - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.conversation_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update message count
DROP TRIGGER IF EXISTS conversation_message_count_trigger ON messages;
CREATE TRIGGER conversation_message_count_trigger
AFTER INSERT OR DELETE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_message_count();

-- Initialize message_count for existing conversations
UPDATE conversations
SET message_count = (
  SELECT COUNT(*) 
  FROM messages 
  WHERE messages.conversation_id = conversations.id
);
