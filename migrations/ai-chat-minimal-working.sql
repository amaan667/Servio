-- MINIMAL AI CHAT SCHEMA - GUARANTEED TO WORK
-- Run this script in Supabase SQL Editor

-- Drop tables if they exist (to start fresh)
DROP TABLE IF EXISTS ai_chat_messages CASCADE;
DROP TABLE IF EXISTS ai_chat_conversations CASCADE;

-- Create conversations table (simplest possible version)
CREATE TABLE ai_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Create messages table
CREATE TABLE ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_params JSONB,
  execution_result JSONB,
  audit_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  can_undo BOOLEAN DEFAULT false,
  undo_data JSONB
);

-- Create basic indexes
CREATE INDEX idx_ai_chat_conversations_venue_user ON ai_chat_conversations(venue_id, user_id);
CREATE INDEX idx_ai_chat_messages_conversation ON ai_chat_messages(conversation_id);

-- Enable RLS
ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Create simple policies (allow all for authenticated users)
CREATE POLICY "Allow all for authenticated users" ON ai_chat_conversations
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users" ON ai_chat_messages
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Test insert (this should work if everything is set up correctly)
INSERT INTO ai_chat_conversations (venue_id, user_id, title) 
VALUES ('test-venue', 'test-user', 'Test Conversation');

-- Verify the insert worked
SELECT COUNT(*) as conversation_count FROM ai_chat_conversations;
