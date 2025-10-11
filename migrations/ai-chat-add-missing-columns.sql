-- Add missing columns to ai_chat_messages table
-- This migration adds the columns that the API expects but are missing from the current schema

-- Add missing columns to ai_chat_messages
ALTER TABLE ai_chat_messages 
ADD COLUMN IF NOT EXISTS tool_name TEXT,
ADD COLUMN IF NOT EXISTS tool_params JSONB,
ADD COLUMN IF NOT EXISTS execution_result JSONB,
ADD COLUMN IF NOT EXISTS audit_id TEXT,
ADD COLUMN IF NOT EXISTS can_undo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS undo_data JSONB;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_chat_messages' 
ORDER BY column_name;
