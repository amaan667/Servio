-- Add RLS Policies Script
-- Run this AFTER the safe migration script to add Row Level Security

-- Step 1: Enable RLS on new tables
ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own conversations" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations for their venues" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON ai_chat_messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON ai_chat_messages;

-- Step 3: Create policies for ai_chat_conversations
-- Try different approaches for UUID casting
CREATE POLICY "Users can view their own conversations" ON ai_chat_conversations
  FOR SELECT USING (user_id = auth.uid()::uuid);

CREATE POLICY "Users can create conversations for their venues" ON ai_chat_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY "Users can update their own conversations" ON ai_chat_conversations
  FOR UPDATE USING (user_id = auth.uid()::uuid);

CREATE POLICY "Users can delete their own conversations" ON ai_chat_conversations
  FOR DELETE USING (user_id = auth.uid()::uuid);

-- Step 4: Create policies for ai_chat_messages
CREATE POLICY "Users can view messages from their conversations" ON ai_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations ac 
      WHERE ac.id = ai_chat_messages.conversation_id 
      AND ac.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can create messages in their conversations" ON ai_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations ac 
      WHERE ac.id = ai_chat_messages.conversation_id 
      AND ac.user_id = auth.uid()::uuid
    )
  );

-- Step 5: Test the policies
SELECT 'RLS policies added successfully!' as status;
