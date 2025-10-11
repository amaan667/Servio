-- Clean up old duplicate conversations from before the fix
-- This will remove all the duplicate "take me to the" conversations

-- First, let's see what we have
SELECT 'Before cleanup:' as status, COUNT(*) as total_conversations FROM ai_chat_conversations;
SELECT title, COUNT(*) as count FROM ai_chat_conversations GROUP BY title ORDER BY count DESC;

-- Delete conversations that have no messages (empty conversations)
DELETE FROM ai_chat_conversations 
WHERE id NOT IN (
  SELECT DISTINCT conversation_id FROM ai_chat_messages
);

-- Delete duplicate conversations with the same title "take me to the"
-- Keep only the most recent one for each user/venue combination
WITH ranked_conversations AS (
  SELECT id,
         venue_id,
         user_id,
         title,
         created_at,
         ROW_NUMBER() OVER (
           PARTITION BY venue_id, user_id, title 
           ORDER BY created_at DESC
         ) as rn
  FROM ai_chat_conversations
  WHERE title = 'take me to the'
)
DELETE FROM ai_chat_conversations 
WHERE id IN (
  SELECT id FROM ranked_conversations WHERE rn > 1
);

-- Delete conversations with generic titles that have no messages
DELETE FROM ai_chat_conversations 
WHERE title LIKE 'take me to the%' 
AND id NOT IN (
  SELECT DISTINCT conversation_id FROM ai_chat_messages
);

-- Delete any other conversations with duplicate titles
-- Keep only the most recent one for each title
WITH ranked_by_title AS (
  SELECT id,
         title,
         created_at,
         ROW_NUMBER() OVER (
           PARTITION BY title 
           ORDER BY created_at DESC
         ) as rn
  FROM ai_chat_conversations
  WHERE title IN (
    SELECT title 
    FROM ai_chat_conversations 
    GROUP BY title 
    HAVING COUNT(*) > 1
  )
)
DELETE FROM ai_chat_conversations 
WHERE id IN (
  SELECT id FROM ranked_by_title WHERE rn > 1
);

-- Show the results after cleanup
SELECT 'After cleanup:' as status, COUNT(*) as total_conversations FROM ai_chat_conversations;
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
ORDER BY c.created_at DESC;
