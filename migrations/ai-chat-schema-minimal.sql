-- AI Assistant Chat System Schema - Minimal Version
-- Creates only the essential tables without complex policies

-- First, let's create the basic tables without any policies
CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_name VARCHAR(100),
  tool_params JSONB,
  execution_result JSONB,
  audit_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  can_undo BOOLEAN DEFAULT false,
  undo_data JSONB
);

CREATE TABLE IF NOT EXISTS ai_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  context_type VARCHAR(50) NOT NULL,
  context_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(venue_id, context_type)
);

CREATE TABLE IF NOT EXISTS ai_action_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  intent TEXT NOT NULL,
  tool_name VARCHAR(100) NOT NULL,
  params JSONB NOT NULL,
  preview BOOLEAN NOT NULL DEFAULT false,
  executed BOOLEAN NOT NULL DEFAULT false,
  result JSONB,
  error TEXT,
  context_hash VARCHAR(255),
  model_version VARCHAR(50),
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_venue_id ON ai_chat_conversations(venue_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_user_id ON ai_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_id ON ai_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_cache_venue_id ON ai_context_cache(venue_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_audit_venue_id ON ai_action_audit(venue_id);

-- Enable RLS but don't create policies yet
ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_action_audit ENABLE ROW LEVEL SECURITY;

-- Create simple policies that avoid type casting issues
CREATE POLICY IF NOT EXISTS "Allow all operations for authenticated users" ON ai_chat_conversations
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Allow all operations for authenticated users" ON ai_chat_messages
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Allow all operations for authenticated users" ON ai_context_cache
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Allow all operations for authenticated users" ON ai_action_audit
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_chat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_update_ai_chat_conversations_updated_at ON ai_chat_conversations;
CREATE TRIGGER trigger_update_ai_chat_conversations_updated_at
  BEFORE UPDATE ON ai_chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_chat_conversations_updated_at();
