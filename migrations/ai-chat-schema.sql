-- AI Assistant Chat System Schema
-- Stores conversation history and enables undo functionality

-- Chat conversations table
CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_name VARCHAR(100), -- Tool that was executed (if applicable)
  tool_params JSONB, -- Parameters passed to the tool
  execution_result JSONB, -- Result of tool execution
  audit_id UUID, -- Link to audit trail (optional reference)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  can_undo BOOLEAN DEFAULT false, -- Whether this action can be undone
  undo_data JSONB -- Data needed to undo the action
);

-- Undo actions table
CREATE TABLE IF NOT EXISTS ai_undo_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES ai_chat_messages(id) ON DELETE CASCADE,
  undo_type VARCHAR(50) NOT NULL, -- Type of undo (e.g., 'menu_translation', 'price_change', 'item_creation')
  undo_params JSONB NOT NULL, -- Parameters needed to undo the action
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_by UUID NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_venue_id ON ai_chat_conversations(venue_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_user_id ON ai_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_created_at ON ai_chat_conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_id ON ai_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at ON ai_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_tool_name ON ai_chat_messages(tool_name);

CREATE INDEX IF NOT EXISTS idx_ai_undo_actions_message_id ON ai_undo_actions(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_undo_actions_executed_at ON ai_undo_actions(executed_at DESC);

-- Row Level Security (RLS)
ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_undo_actions ENABLE ROW LEVEL SECURITY;

-- Policies for ai_chat_conversations
CREATE POLICY "Users can view their own conversations" ON ai_chat_conversations
  FOR SELECT USING (
    auth.uid() = user_id
  );

CREATE POLICY "Users can create conversations for their venues" ON ai_chat_conversations
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "Users can update their own conversations" ON ai_chat_conversations
  FOR UPDATE USING (
    auth.uid() = user_id
  );

CREATE POLICY "Users can delete their own conversations" ON ai_chat_conversations
  FOR DELETE USING (
    auth.uid() = user_id
  );

-- Policies for ai_chat_messages
CREATE POLICY "Users can view messages from their conversations" ON ai_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations ac 
      WHERE ac.id = ai_chat_messages.conversation_id 
      AND ac.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their conversations" ON ai_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations ac 
      WHERE ac.id = ai_chat_messages.conversation_id 
      AND ac.user_id = auth.uid()
    )
  );

-- Policies for ai_undo_actions
CREATE POLICY "Users can view undo actions from their conversations" ON ai_undo_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_chat_messages acm
      JOIN ai_chat_conversations acc ON acc.id = acm.conversation_id
      WHERE acm.id = ai_undo_actions.message_id 
      AND acc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create undo actions for their conversations" ON ai_undo_actions
  FOR INSERT WITH CHECK (
    auth.uid() = executed_by AND
    EXISTS (
      SELECT 1 FROM ai_chat_messages acm
      JOIN ai_chat_conversations acc ON acc.id = acm.conversation_id
      WHERE acm.id = ai_undo_actions.message_id 
      AND acc.user_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_chat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_chat_conversations_updated_at
  BEFORE UPDATE ON ai_chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_chat_conversations_updated_at();
