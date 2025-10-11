-- Cleanup script to remove duplicate conversations
-- Run this in Supabase SQL Editor to clean up the mess

-- First, let's see what we have
SELECT COUNT(*) as total_conversations FROM ai_chat_conversations;
SELECT title, COUNT(*) as count FROM ai_chat_conversations GROUP BY title ORDER BY count DESC;

-- Delete conversations that have no messages (empty conversations)
DELETE FROM ai_chat_conversations 
WHERE id NOT IN (
  SELECT DISTINCT conversation_id FROM ai_chat_messages
);

-- Delete duplicate conversations with the same title "New Conversation" 
-- Keep only the most recent one for each user/venue combination
DELETE FROM ai_chat_conversations 
WHERE title = 'New Conversation'
AND id NOT IN (
  SELECT DISTINCT ON (venue_id, user_id) id
  FROM ai_chat_conversations 
  WHERE title = 'New Conversation'
  ORDER BY venue_id, user_id, created_at DESC
); 

-- Delete conversations with generic titles that have no messages
DELETE FROM ai_chat_conversations 
WHERE title LIKE 'Conversation %' 
AND id NOT IN (
  SELECT DISTINCT conversation_id FROM ai_chat_messages
);

-- Show the results after cleanup
SELECT COUNT(*) as remaining_conversations FROM ai_chat_conversations;
SELECT title, COUNT(*) as count FROM ai_chat_conversations GROUP BY title ORDER BY count DESC;

-- Show conversations that actually have messages
SELECT 
  c.id,
  c.title,
  c.created_at,
  COUNT(m.id) as message_count
FROM ai_chat_conversations c
LEFT JOIN ai_chat_messages m ON c.id = m.conversation_id
GROUP BY c.id, c.title, c.created_at
HAVING COUNT(m.id) > 0
ORDER BY c.created_at DESC;
