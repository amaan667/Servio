-- AI Chat Schema Fix - Run this in Supabase SQL Editor
-- This will create the tables if they don't exist and won't error if they do

-- Drop existing tables to start fresh (comment out if you want to keep data)
DROP TABLE IF EXISTS ai_chat_messages CASCADE;
DROP TABLE IF EXISTS ai_chat_conversations CASCADE;
DROP TABLE IF EXISTS ai_undo_actions CASCADE;

-- Create conversations table
CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create undo actions table
CREATE TABLE IF NOT EXISTS ai_undo_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  original_state JSONB,
  executed_by TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  can_undo BOOLEAN DEFAULT true
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_venue ON ai_chat_conversations(venue_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON ai_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON ai_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_undo_conversation ON ai_undo_actions(conversation_id);

-- Enable RLS
ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_undo_actions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own conversations" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON ai_chat_messages;
DROP POLICY IF EXISTS "Users can create messages" ON ai_chat_messages;
DROP POLICY IF EXISTS "Users can view undo actions" ON ai_undo_actions;
DROP POLICY IF EXISTS "Users can create undo actions" ON ai_undo_actions;

-- Create RLS policies - Simple version that allows all authenticated users
CREATE POLICY "Users can view their own conversations"
  ON ai_chat_conversations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create conversations"
  ON ai_chat_conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their conversations"
  ON ai_chat_conversations FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view messages in their conversations"
  ON ai_chat_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create messages"
  ON ai_chat_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view undo actions"
  ON ai_undo_actions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create undo actions"
  ON ai_undo_actions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_chat_conversations_updated_at ON ai_chat_conversations;
CREATE TRIGGER update_ai_chat_conversations_updated_at
  BEFORE UPDATE ON ai_chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verify tables were created
SELECT 'ai_chat_conversations' as table_name, COUNT(*) as row_count FROM ai_chat_conversations
UNION ALL
SELECT 'ai_chat_messages', COUNT(*) FROM ai_chat_messages
UNION ALL
SELECT 'ai_undo_actions', COUNT(*) FROM ai_undo_actions;

