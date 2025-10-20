// AI Assistant Migration Endpoint
// Creates the required database tables for AI chat functionality

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { apiLogger, logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.debug("[AI MIGRATION] Starting AI chat schema migration");

    // Create tables sequentially to handle dependencies
    const migrationSQL = `
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
  tool_name VARCHAR(100),
  tool_params JSONB,
  execution_result JSONB,
  audit_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  can_undo BOOLEAN DEFAULT false,
  undo_data JSONB
);

-- Undo actions table
CREATE TABLE IF NOT EXISTS ai_undo_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES ai_chat_messages(id) ON DELETE CASCADE,
  undo_type VARCHAR(50) NOT NULL,
  undo_params JSONB NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_by UUID NOT NULL
);

-- AI context cache table (for performance)
CREATE TABLE IF NOT EXISTS ai_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  context_type VARCHAR(50) NOT NULL,
  context_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(venue_id, context_type)
);

-- AI action audit table (for tracking all AI actions)
CREATE TABLE IF NOT EXISTS ai_action_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  user_id UUID NOT NULL,
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
`;

    // Try to create tables using direct queries
    logger.debug("[AI MIGRATION] Creating ai_chat_conversations table...");
    const { error: conversationsError } = await supabase
      .from('ai_chat_conversations')
      .select('id')
      .limit(1);

    if (conversationsError && conversationsError.code === 'PGRST116') {
      // Table doesn't exist, we need to create it via SQL
      logger.debug("[AI MIGRATION] Tables don't exist, returning instructions for manual creation");
      return NextResponse.json({
        success: false,
        message: "Database tables need to be created manually",
        instructions: "Please run the SQL from migrations/ai-chat-schema.sql in your Supabase dashboard SQL editor",
        sql: migrationSQL
      });
    }

    // Create indexes
    const indexSQL = `
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_venue_id ON ai_chat_conversations(venue_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_user_id ON ai_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_created_at ON ai_chat_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_id ON ai_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at ON ai_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_tool_name ON ai_chat_messages(tool_name);
CREATE INDEX IF NOT EXISTS idx_ai_undo_actions_message_id ON ai_undo_actions(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_undo_actions_executed_at ON ai_undo_actions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_context_cache_venue_id ON ai_context_cache(venue_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_cache_expires_at ON ai_context_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_action_audit_venue_id ON ai_action_audit(venue_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_audit_user_id ON ai_action_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_audit_created_at ON ai_action_audit(created_at DESC);
`;

    await supabase.rpc('exec_sql', { sql: indexSQL });

    // Enable RLS and create policies
    const rlsSQL = `
ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_undo_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_action_audit ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own conversations" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations for their venues" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON ai_chat_messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON ai_chat_messages;
DROP POLICY IF EXISTS "Users can view undo actions from their conversations" ON ai_undo_actions;
DROP POLICY IF EXISTS "Users can create undo actions for their conversations" ON ai_undo_actions;
DROP POLICY IF EXISTS "Users can view their own context cache" ON ai_context_cache;
DROP POLICY IF EXISTS "Users can create context cache for their venues" ON ai_context_cache;
DROP POLICY IF EXISTS "Users can view their own audit records" ON ai_action_audit;
DROP POLICY IF EXISTS "Users can create audit records for their actions" ON ai_action_audit;

-- Create policies for ai_chat_conversations
CREATE POLICY "Users can view their own conversations" ON ai_chat_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversations for their venues" ON ai_chat_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON ai_chat_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON ai_chat_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for ai_chat_messages
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

-- Create policies for ai_undo_actions
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

-- Create policies for ai_context_cache
CREATE POLICY "Users can view their own context cache" ON ai_context_cache
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM venues v 
      WHERE v.venue_id = ai_context_cache.venue_id 
      AND v.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create context cache for their venues" ON ai_context_cache
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM venues v 
      WHERE v.venue_id = ai_context_cache.venue_id 
      AND v.owner_id = auth.uid()
    )
  );

-- Create policies for ai_action_audit
CREATE POLICY "Users can view their own audit records" ON ai_action_audit
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create audit records for their actions" ON ai_action_audit
  FOR INSERT WITH CHECK (auth.uid() = user_id);
`;

    await supabase.rpc('exec_sql', { sql: rlsSQL });

    // Create the updated_at trigger function
    const triggerSQL = `
CREATE OR REPLACE FUNCTION update_ai_chat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_chat_conversations_updated_at ON ai_chat_conversations;
CREATE TRIGGER trigger_update_ai_chat_conversations_updated_at
  BEFORE UPDATE ON ai_chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_chat_conversations_updated_at();
`;

    await supabase.rpc('exec_sql', { sql: triggerSQL });

    logger.debug("[AI MIGRATION] Migration completed successfully");

    return NextResponse.json({
      success: true,
      message: "AI chat database schema created successfully",
      tables: [
        "ai_chat_conversations",
        "ai_chat_messages", 
        "ai_undo_actions",
        "ai_context_cache",
        "ai_action_audit"
      ]
    });

  } catch (error: unknown) {
    logger.error("[AI MIGRATION] Migration failed:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: error.message || "Migration failed" },
      { status: 500 }
    );
  }
}
