-- Add advanced configuration options for agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS response_format TEXT DEFAULT 'text';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS store_conversations BOOLEAN DEFAULT FALSE;

-- response_format can be: 'text', 'json_object', or 'json_schema'
-- store_conversations corresponds to OpenAI's 'store' parameter
