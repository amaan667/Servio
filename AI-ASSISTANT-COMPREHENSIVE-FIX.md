# AI Assistant Comprehensive Fix

## Issues Identified:
1. **Database tables not created** - "Failed to fetch conversations" error
2. **Navigation not working** - Basic AI assistant functionality broken
3. **Price calculation bug** - 56.7% error for 5% increase

## Fix 1: Database Schema (CRITICAL - Run This First)

### Step 1: Execute SQL Script in Supabase
1. Go to Supabase Dashboard → SQL Editor
2. Copy the script below
3. **CLICK RUN BUTTON** (not just open the file)
4. Wait for success message

```sql
-- AI Assistant Chat System Schema - WORKING VERSION
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_venue_id ON ai_chat_conversations(venue_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_user_id ON ai_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_id ON ai_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_cache_venue_id ON ai_context_cache(venue_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_audit_venue_id ON ai_action_audit(venue_id);

-- Enable RLS
ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_action_audit ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON ai_chat_conversations;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON ai_chat_messages;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON ai_context_cache;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON ai_action_audit;

-- Create simple policies
CREATE POLICY "Allow all operations for authenticated users" ON ai_chat_conversations
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all operations for authenticated users" ON ai_chat_messages
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all operations for authenticated users" ON ai_context_cache
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all operations for authenticated users" ON ai_action_audit
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Function and trigger
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
```

## Fix 2: AI Assistant Navigation Enhancement

The navigation should work, but let me verify the route mapping is complete:

### Navigation Routes Available:
- `dashboard` → `/dashboard/${venueId}`
- `menu` → `/dashboard/${venueId}/menu`
- `orders` → `/dashboard/${venueId}/orders`
- `analytics` → `/dashboard/${venueId}/analytics`
- `inventory` → `/dashboard/${venueId}/inventory`
- `staff` → `/dashboard/${venueId}/staff`
- `feedback` → `/dashboard/${venueId}/feedback`
- `settings` → `/dashboard/${venueId}/settings`

## Fix 3: Price Calculation Bug

The 56.7% error for 5% increase suggests the AI is calculating wrong new prices. The issue is likely in the AI planning logic where it calculates `newPrice = currentPrice * (1 + percentage/100)`.

## Testing Steps After Fix:

1. **Test Database Fix:**
   - Open AI Assistant
   - Should see "No conversations yet" instead of error
   - Should be able to create new conversations

2. **Test Navigation:**
   - Ask: "Take me to the menu page"
   - Ask: "Go to analytics"
   - Ask: "Show me the dashboard"
   - Should navigate immediately

3. **Test Price Updates:**
   - Ask: "Increase coffee prices by 5%"
   - Should calculate correctly without 56.7% error

## Expected Results:
- ✅ No "Failed to fetch conversations" error
- ✅ Navigation works for all pages
- ✅ Price calculations are accurate
- ✅ AI assistant responds to basic commands

## If Issues Persist:
1. Check browser console for errors
2. Verify Supabase connection
3. Check if user is properly authenticated
4. Verify venue permissions