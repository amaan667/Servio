-- Production-Ready AI Chat Schema
-- Implements proper RLS, venue access control, and tool calling support

-- 1) Conversations
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  created_by UUID NOT NULL,                -- auth.uid()
  title TEXT DEFAULT 'New Conversation',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Messages
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('system','user','assistant','tool')),
  -- raw text for display; model could send multiple parts but store the final user-facing text here
  text TEXT,
  -- full structured content (for tools, images, function args, etc.)
  content JSONB DEFAULT '{}'::jsonb,
  call_id TEXT,            -- correlates tool call ↔ tool output
  tool_name TEXT,          -- when role='tool'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX idx_ai_conversations_venue_last_message ON ai_conversations (venue_id, last_message_at DESC);
CREATE INDEX idx_ai_conversations_created_by ON ai_conversations (created_by);
CREATE INDEX idx_ai_messages_conversation_created ON ai_messages (conversation_id, created_at);
CREATE INDEX idx_ai_messages_venue_created ON ai_messages (venue_id, created_at);

-- RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- Policy: user can read/write only their venue(s)
-- Note: This assumes you have a venues_users table for multi-user access
-- If not, we'll use a simpler policy based on venues.owner_id

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "own-venue-read" ON ai_conversations;
DROP POLICY IF EXISTS "own-venue-write" ON ai_conversations;
DROP POLICY IF EXISTS "own-venue-update" ON ai_conversations;
DROP POLICY IF EXISTS "msg-read" ON ai_messages;
DROP POLICY IF EXISTS "msg-write" ON ai_messages;

-- Check if venues_users table exists, if not use owner_id approach
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'venues_users') THEN
        -- Multi-user venue access
        CREATE POLICY "own-venue-read"
        ON ai_conversations FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM venues_users vu
          WHERE vu.venue_id = ai_conversations.venue_id
            AND vu.user_id = auth.uid()
        ));

        CREATE POLICY "own-venue-write"
        ON ai_conversations FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM venues_users vu
                  WHERE vu.venue_id = ai_conversations.venue_id
                    AND vu.user_id = auth.uid())
        );

        CREATE POLICY "own-venue-update"
        ON ai_conversations FOR UPDATE USING (
          EXISTS (SELECT 1 FROM venues_users vu
                  WHERE vu.venue_id = ai_conversations.venue_id
                    AND vu.user_id = auth.uid())
        );

        -- Same for messages
        CREATE POLICY "msg-read"
        ON ai_messages FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM venues_users vu
          WHERE vu.venue_id = ai_messages.venue_id
            AND vu.user_id = auth.uid()
        ));

        CREATE POLICY "msg-write"
        ON ai_messages FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM venues_users vu
                  WHERE vu.venue_id = ai_messages.venue_id
                    AND vu.user_id = auth.uid())
        );
    ELSE
        -- Single-owner venue access (current setup)
        CREATE POLICY "own-venue-read"
        ON ai_conversations FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM venues v
          WHERE v.venue_id = ai_conversations.venue_id
            AND v.owner_id = auth.uid()::UUID
        ));

        CREATE POLICY "own-venue-write"
        ON ai_conversations FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM venues v
                  WHERE v.venue_id = ai_conversations.venue_id
                    AND v.owner_id = auth.uid()::UUID)
        );

        CREATE POLICY "own-venue-update"
        ON ai_conversations FOR UPDATE USING (
          EXISTS (SELECT 1 FROM venues v
                  WHERE v.venue_id = ai_conversations.venue_id
                    AND v.owner_id = auth.uid()::UUID)
        );

        -- Same for messages
        CREATE POLICY "msg-read"
        ON ai_messages FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM venues v
          WHERE v.venue_id = ai_messages.venue_id
            AND v.owner_id = auth.uid()::UUID
        ));

        CREATE POLICY "msg-write"
        ON ai_messages FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM venues v
                  WHERE v.venue_id = ai_messages.venue_id
                    AND v.owner_id = auth.uid()::UUID)
        );
    END IF;
END $$;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_conversations_updated_at();

-- Function to update last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_conversations 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();
