-- Safe Migration Script: Create tables first, then add policies
-- This approach avoids UUID casting issues by creating tables without RLS first

-- Step 1: Create the new tables WITHOUT RLS initially
CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  tool_name VARCHAR(100),
  tool_params JSONB,
  execution_result JSONB,
  audit_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  can_undo BOOLEAN DEFAULT false,
  undo_data JSONB
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_venue_id ON ai_chat_conversations(venue_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_user_id ON ai_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_created_at ON ai_chat_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_id ON ai_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at ON ai_chat_messages(created_at DESC);

-- Step 3: Create helper functions first
CREATE OR REPLACE FUNCTION get_conversations_needing_ai_titles()
RETURNS TABLE (
  conversation_id UUID,
  first_user_message TEXT,
  current_title TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    acc.id as conversation_id,
    COALESCE(acm.content, '') as first_user_message,
    acc.title as current_title
  FROM ai_chat_conversations acc
  LEFT JOIN (
    SELECT DISTINCT ON (conversation_id) 
      conversation_id, 
      content
    FROM ai_chat_messages 
    WHERE role = 'user' 
    ORDER BY conversation_id, created_at ASC
  ) acm ON acc.id = acm.conversation_id
  WHERE acc.title IN ('New Conversation', 'Chat Conversation')
     OR acc.title LIKE '%...'
     OR LENGTH(acc.title) > 50
  ORDER BY acc.created_at DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_conversation_ai_title(
  conv_id UUID,
  new_title TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ai_chat_conversations 
  SET title = new_title, updated_at = NOW()
  WHERE id = conv_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create updated_at trigger function
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

-- Step 5: Migrate existing conversations (only if old table exists)
DO $$
DECLARE
  conversation_count INTEGER := 0;
  message_count INTEGER := 0;
BEGIN
  -- Check if ai_conversations table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_conversations') THEN
    
    -- Insert conversations with improved titles
    INSERT INTO ai_chat_conversations (id, venue_id, user_id, title, created_at, updated_at)
    SELECT 
      id, -- Keep the same ID to maintain references
      venue_id,
      created_by::uuid as user_id, -- Ensure proper UUID casting
      CASE 
        -- Generate better titles based on content
        WHEN LENGTH(title) > 50 THEN LEFT(title, 47) || '...'
        WHEN title = 'New Conversation' THEN 'Chat Conversation'
        ELSE title
      END as title,
      created_at,
      updated_at
    FROM ai_conversations
    WHERE NOT EXISTS (
      SELECT 1 FROM ai_chat_conversations acc 
      WHERE acc.id = ai_conversations.id
    );
    
    GET DIAGNOSTICS conversation_count = ROW_COUNT;

    -- Migrate existing messages (only if old messages table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_messages') THEN
      INSERT INTO ai_chat_messages (
        id,
        conversation_id, 
        role, 
        content, 
        tool_name, 
        created_at
      )
      SELECT 
        am.id, -- Keep the same ID
        am.conversation_id,
        CASE 
          WHEN am.author_role = 'tool' THEN 'assistant'
          ELSE am.author_role
        END as role,
        COALESCE(am.text, (am.content->>'text')::text, '') as content,
        am.tool_name,
        am.created_at
      FROM ai_messages am
      WHERE EXISTS (
        SELECT 1 FROM ai_chat_conversations acc 
        WHERE acc.id = am.conversation_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM ai_chat_messages acm 
        WHERE acm.id = am.id
      );
      
      GET DIAGNOSTICS message_count = ROW_COUNT;
    END IF;
    
    RAISE NOTICE 'Migration completed: % conversations and % messages migrated', 
      conversation_count, message_count;
  ELSE
    RAISE NOTICE 'No existing ai_conversations table found, skipping migration';
  END IF;
END $$;

-- Step 6: Add migration status tracking
ALTER TABLE ai_chat_conversations 
ADD COLUMN IF NOT EXISTS migration_status VARCHAR(20) DEFAULT 'migrated';

-- Update migration status for migrated conversations
UPDATE ai_chat_conversations 
SET migration_status = 'migrated'
WHERE migration_status IS NULL;

-- Step 7: Create monitoring view
CREATE OR REPLACE VIEW migration_status AS
SELECT 
  'ai_conversations' as table_name,
  COUNT(*) as total_conversations,
  COUNT(CASE WHEN title = 'New Conversation' THEN 1 END) as generic_titles,
  MIN(created_at) as oldest_conversation,
  MAX(created_at) as newest_conversation
FROM ai_conversations
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_conversations')
UNION ALL
SELECT 
  'ai_chat_conversations' as table_name,
  COUNT(*) as total_conversations,
  COUNT(CASE WHEN title IN ('New Conversation', 'Chat Conversation') THEN 1 END) as generic_titles,
  MIN(created_at) as oldest_conversation,
  MAX(created_at) as newest_conversation
FROM ai_chat_conversations;

-- Display completion message
SELECT 'Tables created successfully! RLS policies can be added separately if needed.' as status;
SELECT * FROM migration_status;
SELECT 
  'Conversations needing AI titles:' as info,
  COUNT(*) as count
FROM get_conversations_needing_ai_titles();
