-- Migration: Add workflow/phases support for multi-phase generation
-- This enables agents like Bob Buildr to generate large documents in phases

-- Add workflow state to conversations
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS workflow_state jsonb DEFAULT NULL;

-- workflow_state structure:
-- {
--   "active": true/false,
--   "type": "soumission_generation",
--   "current_phase": 1,
--   "total_phases": 4,
--   "phases_completed": ["phase1_details"],
--   "context": { ... any data needed across phases ... }
-- }

-- Add max_history_messages to agents (override default 20 messages limit)
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS max_history_messages integer DEFAULT 20;

-- Add max_tokens_override for specific workflows
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS workflow_max_tokens integer DEFAULT NULL;

-- Update Bob Buildr with better settings for multi-phase generation
UPDATE agents 
SET 
  max_history_messages = 50,
  workflow_max_tokens = 4000,
  max_tokens = 4000
WHERE name = 'Bob Buildr';

-- Create index for workflow queries
CREATE INDEX IF NOT EXISTS idx_conversations_workflow_active 
ON conversations ((workflow_state->>'active')) 
WHERE workflow_state IS NOT NULL;

COMMENT ON COLUMN conversations.workflow_state IS 'JSON state for multi-phase workflows (soumission generation, etc.)';
COMMENT ON COLUMN agents.max_history_messages IS 'Maximum conversation history messages to include in context (default 20)';
COMMENT ON COLUMN agents.workflow_max_tokens IS 'Max tokens to use during active workflows (overrides max_tokens)';
