-- Create AI Assistant Tables
-- Stores conversations and messages for the AI chatbot

-- AI Chat Conversations
CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Chat Messages
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_params JSONB,
  execution_result JSONB,
  audit_id UUID,
  undo_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_venue_id ON ai_chat_conversations(venue_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_user_id ON ai_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_id ON ai_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at ON ai_chat_messages(created_at);

-- RLS Policies (Row Level Security)
ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own conversations
CREATE POLICY "Users can view their own conversations"
  ON ai_chat_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to create conversations
CREATE POLICY "Users can create conversations"
  ON ai_chat_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their conversations
CREATE POLICY "Users can update their own conversations"
  ON ai_chat_conversations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow users to delete their conversations
CREATE POLICY "Users can delete their own conversations"
  ON ai_chat_conversations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Allow users to view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
  ON ai_chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations
      WHERE ai_chat_conversations.id = ai_chat_messages.conversation_id
      AND ai_chat_conversations.user_id = auth.uid()
    )
  );

-- Allow users to create messages in their conversations
CREATE POLICY "Users can create messages in their conversations"
  ON ai_chat_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations
      WHERE ai_chat_conversations.id = ai_chat_messages.conversation_id
      AND ai_chat_conversations.user_id = auth.uid()
    )
  );

-- Update updated_at timestamp on conversation when messages are added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_chat_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_timestamp_trigger
  AFTER INSERT ON ai_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Comment the tables
COMMENT ON TABLE ai_chat_conversations IS 'Stores AI assistant chat conversations';
COMMENT ON TABLE ai_chat_messages IS 'Stores individual messages within AI conversations';

